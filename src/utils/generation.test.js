import { describe, it, expect, vi } from 'vitest'
import { parseRows, canGenerate, generateLinks } from './generation.js'

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
  it('drops empty lines and unparseable entries, keeps the rest', () => {
    const raw = '\n  \nvless://a@x.com:443?type=ws#a\nss://nope\n\nvless://b@1.2.3.4:443?type=ws#b\n'
    const rows = parseRows(raw)
    expect(rows.length).toBe(2)
    expect(rows[0].remark).toBe('a')
    expect(rows[1].remark).toBe('b')
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
