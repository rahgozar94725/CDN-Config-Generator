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

  it('V3: host and sni equal the routing subdomain', () => {
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
    const configs = parseAll('vless://uuid@info.example.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], randomSni: true }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out[0]).toMatch(/sni=[a-z0-9]+\.example\.com\./)
    expect(out[0]).not.toMatch(/sni=[a-z0-9]+\.info\.example/)
    expect(out[0]).toMatch(/host=info\.example\.com/)
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

  it('vless links write host and sni equal to the routing subdomain', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws&host=route.example.com#cfg')
    const cdnList = ['9.9.9.9']
    const opts = { enableTls: true, enableNoTls: true, noTlsPorts: [80], tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(2)
    for (const link of out) {
      expect(link).toMatch(/host=route\.example\.com/)
      expect(link).toMatch(/sni=route\.example\.com/)
      expect(link).not.toMatch(/1\.2\.3\.4/)
    }
  })

  it('trojan links write host and sni equal to the routing subdomain', () => {
    const configs = parseAll('trojan://pw@1.2.3.4:443?type=ws&host=route.example.com#cfg')
    const out = generateConfigs(configs, ['9.9.9.9'], { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] })
    expect(out[0]).toMatch(/host=route\.example\.com/)
    expect(out[0]).toMatch(/sni=route\.example\.com/)
    expect(out[0]).not.toMatch(/1\.2\.3\.4/)
  })

  it('vmess links write host and sni equal to the routing subdomain', () => {
    const obj = { v: '2', ps: 'm', add: '1.2.3.4', port: 443, id: 'uuid', net: 'ws', host: 'route.example.com', tls: 'tls' }
    const configs = parseAll('vmess://' + btoa(JSON.stringify(obj)))
    const out = generateConfigs(configs, ['9.9.9.9'], { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] })
    const decoded = JSON.parse(decodeURIComponent(atob(out[0].replace('vmess://', ''))))
    expect(decoded.host).toBe('route.example.com')
    expect(decoded.sni).toBe('route.example.com')
    expect(decoded.add).toBe('9.9.9.9')
  })

  it('V7: random SNI uses root domain of the routing subdomain', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws&host=info.example.com#cfg')
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], randomSni: true }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(out[0]).toMatch(/sni=[a-z0-9]+\.example\.com\./)
    expect(out[0]).not.toMatch(/sni=[a-z0-9]+\.info\.example/)
    expect(out[0]).toMatch(/host=info\.example\.com/)
  })

  // The validation gate rejects a trailing dot before generation, but the root
  // extraction must not rely on it: `example.com.` used to split to a trailing
  // empty label, yielding the root `com.` and an SNI of `rand.com..`.
  it('V7: a trailing dot in the routing subdomain does not corrupt the root domain', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws&host=info.example.com.#cfg')
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], randomSni: true }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(out[0]).toMatch(/sni=[a-z0-9]+\.example\.com\.(?!\.)/)
    expect(out[0]).not.toMatch(/sni=[a-z0-9]+\.com\./)
  })

  it('V7: a single-label routing subdomain yields no empty root', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws&host=abc.#cfg')
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], randomSni: true }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(out[0]).toMatch(/sni=[a-z0-9]+\.abc\.(?!\.)/)
  })

  it('edited routing subdomain propagates to its links only', () => {
    const raw = 'vless://a@host1.com:443?type=ws#a\ntrojan://b@host2.com:443?type=ws#b'
    const configs = parseAll(raw)
    configs[0].routingSubdomain = 'cdn.example.com'
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(out[0]).toMatch(/host=cdn\.example\.com/)
    expect(out[0]).toMatch(/sni=cdn\.example\.com/)
    expect(out[1]).toMatch(/host=host2\.com/)
    expect(out[1]).toMatch(/sni=host2\.com/)
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
