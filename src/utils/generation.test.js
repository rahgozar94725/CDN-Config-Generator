import { describe, it, expect, vi } from 'vitest'
import { parseRows, removeLines, canGenerate, generateLinks } from './generation.js'

const goodOpts = {
  enableTls: true,
  enableNoTls: true,
  noTlsPorts: [80],
  tlsPorts: [443],
  alpn: ['h2'],
  fingerprint: ['chrome'],
  randomSni: false,
}

describe('parseRows', () => {
  it('drops blank lines but keeps every other line as a row', () => {
    const raw = '\n  \nvless://a@x.com:443?type=ws#a\nnot a link\n\nvless://b@1.2.3.4:443?type=ws#b\n'
    const rows = parseRows(raw)
    expect(rows.map(r => r.status)).toEqual(['ok', 'unparsed', 'ok'])
    expect(rows[0].remark).toBe('a')
    expect(rows[1].raw).toBe('not a link')
    expect(rows[2].remark).toBe('b')
  })

  // Deletion rewrites the user's textarea, so a row must know which line it came
  // from — blank lines make row position and line number disagree.
  it('carries the source line index through blank lines', () => {
    const raw = 'vless://a@x.com:443?type=ws#a\n\n\nvless://b@y.com:443?type=ws#b'
    expect(parseRows(raw).map(r => r.line)).toEqual([0, 3])
  })

  it('marks an incompatible config with its reason', () => {
    const rows = parseRows(
      'vless://a@x.com:443?type=kcp#a\n' +
      'vless://b@x.com:443?type=ws&security=reality&pbk=K#b\n' +
      'vless://c@x.com:443?type=ws&flow=xtls-rprx-vision#c'
    )
    expect(rows.map(r => r.status)).toEqual(['incompatible', 'incompatible', 'incompatible'])
    expect(rows.map(r => r.incompatibleReason)).toEqual(['transport', 'security', 'flow'])
  })
})

describe('removeLines', () => {
  it('removes exactly the addressed lines and leaves the rest verbatim', () => {
    const raw = 'one\ntwo\nthree'
    expect(removeLines(raw, [1])).toBe('one\nthree')
    expect(removeLines(raw, [0, 2])).toBe('two')
    expect(removeLines(raw, [])).toBe(raw)
  })

  // Two identical lines are two rows sharing one fingerprint; deleting one must
  // not take both.
  it('removes one of two identical lines', () => {
    const raw = 'vless://a@x.com:443?type=ws#a\nvless://a@x.com:443?type=ws#a'
    expect(removeLines(raw, [0])).toBe('vless://a@x.com:443?type=ws#a')
  })
})

describe('canGenerate', () => {
  it('V6: false when an active mode has no ports', () => {
    const rows = parseRows('vless://a@x.com:443?type=ws#a')
    const cdn = ['1.1.1.1']
    expect(canGenerate(rows, cdn, { ...goodOpts, tlsPorts: [], enableNoTls: false })).toBe(false)
    expect(canGenerate(rows, cdn, goodOpts)).toBe(true)
  })

  it('V8: false when TLS on but alpn or fingerprint empty', () => {
    const rows = parseRows('vless://a@x.com:443?type=ws#a')
    const cdn = ['1.1.1.1']
    expect(canGenerate(rows, cdn, { ...goodOpts, alpn: [], enableNoTls: false })).toBe(false)
    expect(canGenerate(rows, cdn, { ...goodOpts, fingerprint: [], enableNoTls: false })).toBe(false)
  })

  it('V10: false when a required routing subdomain is empty, true after filled', () => {
    const rows = parseRows('vless://a@1.2.3.4:443?type=ws#a')
    const cdn = ['1.1.1.1']
    expect(canGenerate(rows, cdn, goodOpts)).toBe(false)
    rows[0].routingSubdomain = 'route.example.com'
    expect(canGenerate(rows, cdn, goodOpts)).toBe(true)
  })

  it('false when there are no rows or no cdn hosts', () => {
    expect(canGenerate([], ['1.1.1.1'], goodOpts)).toBe(false)
    expect(canGenerate(parseRows('vless://a@x.com:443?type=ws#a'), [], goodOpts)).toBe(false)
  })

  // V13: a parsed-but-excluded row would otherwise satisfy "at least one row"
  // and produce an empty output — the case V13 exists to prevent.
  it('V13: false when every row is excluded, whatever the passthrough setting', () => {
    const rows = parseRows('vless://a@x.com:443?type=kcp#a\nnot a link')
    expect(canGenerate(rows, ['1.1.1.1'], goodOpts)).toBe(false)
    expect(canGenerate(rows, ['1.1.1.1'], { ...goodOpts, includeExcluded: true })).toBe(false)
  })

  it('V13: true as soon as one compatible row is present alongside excluded ones', () => {
    const rows = parseRows('vless://a@x.com:443?type=kcp#a\nvless://b@y.com:443?type=ws#b')
    expect(canGenerate(rows, ['1.1.1.1'], goodOpts)).toBe(true)
  })
})

describe('generateLinks', () => {
  const tlsOnly = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }

  it('V1: count correct through the pipeline (2 configs × 2 cdn × 2 modes)', async () => {
    const rows = parseRows('vless://a@x.com:443?type=ws#a\ntrojan://b@y.com:443?type=ws#b')
    const cdn = ['1.1.1.1', '2.2.2.2']
    const out = await generateLinks(rows, cdn, goodOpts)
    expect(out.links).toHaveLength(8)
    expect(out.dropped).toBe(0)
  })

  it('V10: filled routing subdomain flows into output host/sni', async () => {
    const rows = parseRows('vless://a@1.2.3.4:443?type=ws#a')
    rows[0].routingSubdomain = 'route.example.com'
    const out = await generateLinks(rows, ['9.9.9.9'], tlsOnly)
    expect(out.links[0]).toMatch(/host=route\.example\.com/)
    expect(out.links[0]).toMatch(/sni=route\.example\.com/)
  })

  // The per-config remark counter was the reported defect: two rows sharing a
  // remark both produced SS-001. Numbering now spans the whole run per remark
  // text (V4), so shared remarks get unique sequential labels.
  it('V4: numbers per remark text across the whole run, not per config', async () => {
    const rows = parseRows('vless://a@x1.com:443?type=ws#ss\ntrojan://b@x2.com:443?type=ws#ss')
    const out = await generateLinks(rows, ['1.1.1.1'], tlsOnly)
    expect(out.links[0]).toMatch(/#ss-001$/)
    expect(out.links[1]).toMatch(/#ss-002$/)
  })

  it('V4: distinct remarks each restart at 001', async () => {
    const rows = parseRows('vless://a@x1.com:443?type=ws#ss\nvless://b@x2.com:443?type=ws#gg')
    const out = await generateLinks(rows, ['1.1.1.1'], tlsOnly)
    expect(out.links[0]).toMatch(/#ss-001$/)
    expect(out.links[1]).toMatch(/#gg-001$/)
  })

  it('V4: configs without a remark share the implicit config- sequence', async () => {
    const rows = parseRows('vless://a@x1.com:443?type=ws\nvless://b@x2.com:443?type=ws')
    const out = await generateLinks(rows, ['1.1.1.1'], tlsOnly)
    expect(out.links[0]).toMatch(/#config-001$/)
    expect(out.links[1]).toMatch(/#config-002$/)
  })

  // The reported defect: No-TLS and TLS variants of one endpoint each expanded,
  // and the cross-config pairs were semantically identical. 8 built links must
  // collapse to the 4 distinct ones, first-wins, with the drop reported (V1).
  it('V1: dedups the No-TLS and TLS variants of one endpoint and reports the drop', async () => {
    const rows = parseRows(
      'vless://u@x.com:80?type=ws&host=route.example.com#a\n' +
      'vless://u@x.com:443?type=ws&security=tls&host=route.example.com#b'
    )
    const cdn = ['1.1.1.1', '2.2.2.2']
    const out = await generateLinks(rows, cdn, goodOpts)
    expect(out.links).toHaveLength(4)
    expect(out.dropped).toBe(4)
    expect(out.links[0]).toMatch(/#a-001$/)
    expect(out.links[1]).toMatch(/#a-002$/)
    expect(out.links[2]).toMatch(/#a-003$/)
    expect(out.links[3]).toMatch(/#a-004$/)
  })

  it('V1: dedups links that differ only in query-parameter order', async () => {
    const rows = parseRows(
      'vless://u@x.com:443?type=ws&host=route.example.com&security=tls#a\n' +
      'vless://u@x.com:443?security=tls&host=route.example.com&type=ws#b'
    )
    const out = await generateLinks(rows, ['1.1.1.1'], tlsOnly)
    expect(out.links).toHaveLength(1)
    expect(out.dropped).toBe(1)
    expect(out.links[0]).toMatch(/#a-001$/)
  })

  it('V1: dedups vmess links by dropping ps, through the pipeline', async () => {
    const vm = ps => 'vmess://' + btoa(JSON.stringify({ v: '2', ps, add: 'x.com', port: 443, id: 'uuid', net: 'ws', host: 'route.example.com', path: '/', tls: 'tls' }))
    const rows = parseRows(vm('one') + '\n' + vm('two'))
    const out = await generateLinks(rows, ['1.1.1.1'], tlsOnly)
    expect(out.links).toHaveLength(1)
    expect(out.dropped).toBe(1)
  })

  it('V5: passthrough raw lines are not deduplicated and stay bit-identical', async () => {
    const rows = parseRows(
      'vless://u@x.com:443?type=ws&host=route.example.com#a\n' +
      'vless://u@x.com:443?type=ws&host=route.example.com#b\n' +
      'vless://bad@x.com:443?type=tcp#raw'
    )
    const out = await generateLinks(rows, ['1.1.1.1'], { ...tlsOnly, includeExcluded: true })
    expect(out.links).toHaveLength(2)
    expect(out.links[0]).toMatch(/#a-001$/)
    expect(out.links[1]).toBe('vless://bad@x.com:443?type=tcp#raw')
    expect(out.dropped).toBe(1)
  })

  it('calls onProgress once per config with correct totals', async () => {
    const rows = parseRows('vless://a@x.com:443?type=ws#a\ntrojan://b@y.com:443?type=ws#b')
    const onProgress = vi.fn()
    await generateLinks(rows, ['1.1.1.1'], { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }, onProgress)
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('returns a Promise (non-blocking contract)', () => {
    expect(generateLinks([], [], {})).toBeInstanceOf(Promise)
  })
})
