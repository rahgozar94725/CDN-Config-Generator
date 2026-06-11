import { describe, it, expect } from 'vitest'
import { generateConfigs } from './multiplier.js'
import { parseConfig } from './parser.js'

function parseAll(lines) {
  return lines.split('\n').filter(Boolean).map(parseConfig)
}

describe('multiplier', () => {
  it('V1: output count correct for simple case', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws&security=tls#cfg')
    const cdnList = ['1.1.1.1', '2.2.2.2']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(2)
  })

  it('V1: output with both TLS and No-TLS ports', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: true, noTlsPorts: [80, 8080], tlsPorts: [443, 8443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(4)
  })

  it('V2: all processed configs have security=tls or security=none', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: true, noTlsPorts: [80], tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    for (const link of out) {
      expect(link).toMatch(/security=(tls|none)/)
    }
  })

  it('V3: original address moved to host and sni', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out[0]).toMatch(/host=orig\.com/)
    expect(out[0]).toMatch(/sni=orig\.com/)
    expect(out[0]).toMatch(/@1\.1\.1\.1:443/)
  })

  it('V4: remark suffix is 3-digit incrementing', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws#mycfg')
    const cdnList = ['1.1.1.1', '2.2.2.2']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out[0]).toMatch(/#mycfg-001$/)
    expect(out[1]).toMatch(/#mycfg-002$/)
  })

  it('V5: non-allowed transport passes through unchanged', () => {
    const raw = 'vless://uuid@orig.com:443?type=tcp#cfg'
    const configs = parseAll(raw)
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(1)
    expect(out[0]).toBe(raw)
  })

  it('handles multiple input configs', () => {
    const raw = 'vless://a@x.com:443?type=ws#a\ntrojan://b@y.com:443?type=ws#b'
    const configs = parseAll(raw)
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(2)
  })

  it('generates ALPN and fingerprint combos for TLS', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2', 'http/1.1'], fingerprint: ['chrome', 'firefox'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(4)
    expect(out[0]).toMatch(/alpn=h2/)
    expect(out[0]).toMatch(/fp=chrome/)
    expect(out[1]).toMatch(/alpn=h2/)
    expect(out[1]).toMatch(/fp=firefox/)
    expect(out[2]).toMatch(/alpn=http%2F1\.1/)
    expect(out[2]).toMatch(/fp=chrome/)
  })

  it('V7: random SNI strips subdomain, uses root domain only', () => {
    const configs = parseAll('vless://uuid@info.wikigap.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], randomSni: true }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out[0]).toMatch(/sni=[a-z0-9]+\.wikigap\.com\./)
    expect(out[0]).not.toMatch(/sni=[a-z0-9]+\.info\.wikigap/)
    expect(out[0]).toMatch(/host=info\.wikigap\.com/)
  })

  it('V8: TLS mode requires at least one ALPN and one fingerprint', () => {
    const configs = parseAll('vless://uuid@orig.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const optsTlsNoAlpn = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: [], fingerprint: ['chrome'] }
    const optsTlsNoFp = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: [] }
    const outNoAlpn = generateConfigs(configs, cdnList, optsTlsNoAlpn)
    const outNoFp = generateConfigs(configs, cdnList, optsTlsNoFp)
    expect(outNoAlpn[0]).toMatch(/fp=chrome/)
    expect(outNoAlpn[0]).not.toMatch(/alpn=/)
    expect(outNoFp[0]).toMatch(/alpn=h2/)
    expect(outNoFp[0]).not.toMatch(/fp=/)
  })

  it('vmess config generates valid base64', () => {
    const configs = parseAll('vmess://' + btoa(JSON.stringify({ v: '2', ps: 'm', add: 'x.com', port: 443, id: 'uuid', net: 'ws', host: 'x.com', path: '/ws', tls: 'tls' })))
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: false, enableNoTls: true, noTlsPorts: [80], alpn: [], fingerprint: [] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(1)
    expect(out[0]).toMatch(/^vmess:\/\//)
  })
})
