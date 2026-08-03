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
  it('V1: count correct through the pipeline (2 configs × 2 cdn × 2 modes)', async () => {
    const rows = parseRows('vless://a@x.com:443?type=ws#a\ntrojan://b@y.com:443?type=ws#b')
    const cdn = ['1.1.1.1', '2.2.2.2']
    const out = await generateLinks(rows, cdn, goodOpts)
    expect(out.length).toBe(8)
  })

  it('V10: filled routing subdomain flows into output host/sni', async () => {
    const rows = parseRows('vless://a@1.2.3.4:443?type=ws#a')
    rows[0].routingSubdomain = 'route.example.com'
    const out = await generateLinks(rows, ['9.9.9.9'], { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] })
    expect(out[0]).toMatch(/host=route\.example\.com/)
    expect(out[0]).toMatch(/sni=route\.example\.com/)
  })

  it('preserves the per-config remark suffix reset', async () => {
    const rows = parseRows('vless://a@x.com:443?type=ws#a\ntrojan://b@y.com:443?type=ws#b')
    const out = await generateLinks(rows, ['1.1.1.1'], { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] })
    expect(out[0]).toMatch(/#a-001$/)
    expect(out[1]).toMatch(/#b-001$/)
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
