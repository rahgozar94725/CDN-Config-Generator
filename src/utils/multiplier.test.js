import { describe, it, expect } from 'vitest'
import { generateConfigs } from './multiplier.js'
import { parseRows } from './generation.js'
import { encodeBase64 } from './parser.js'
import { decodeVmessLink } from './roundtrip.js'

// Rows, not bare parse output: generateConfigs decides what to emit from a row's
// status, which parseRows is what assigns.
function parseAll(lines) {
  return parseRows(lines)
}

// A generated vmess payload is base64 of UTF-8 JSON bytes, so a client reads it
// in one step. The round-trip module's decoder is that read, written
// independently of the parser: an extra decode step here would make a
// non-standard payload look correct.
function readVmess(link) {
  return decodeVmessLink(link).params
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

  it('V5: an excluded row is left out of the output by default', () => {
    const raw = 'vless://uuid@orig.com:443?type=tcp#cfg'
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    expect(generateConfigs(parseAll(raw), cdnList, opts)).toEqual([])
  })

  it('V5: includeExcluded copies an excluded row through bit-identical', () => {
    const raw = 'vless://uuid@orig.com:443?type=tcp#cfg'
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], includeExcluded: true }
    const out = generateConfigs(parseAll(raw), cdnList, opts)
    expect(out).toEqual([raw])
  })

  it('V5: an unparsed line passes through as its own text, never as a link', () => {
    const raw = 'vless://uuid@orig.com:443?type=ws#ok\nthis is not a link'
    const cdnList = ['1.1.1.1']
    const base = { enableTls: false, enableNoTls: true, noTlsPorts: [80], alpn: [], fingerprint: [] }
    expect(generateConfigs(parseAll(raw), cdnList, base).length).toBe(1)
    const withExcluded = generateConfigs(parseAll(raw), cdnList, { ...base, includeExcluded: true })
    expect(withExcluded.length).toBe(2)
    expect(withExcluded[1]).toBe('this is not a link')
  })

  // The reported defect: REALITY was never examined, so an allowed transport
  // carried it straight into a rewritten link with pbk/sid/spx still attached.
  it('a REALITY config never reaches the output, params and all', () => {
    const raw = 'vless://uuid@orig.com:443?type=ws&security=reality&pbk=KEY&sid=ab&spx=%2F#cfg'
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    expect(generateConfigs(parseAll(raw), ['1.1.1.1'], opts)).toEqual([])
  })

  it('a flow config without VLESS Encryption never reaches the output', () => {
    const raw = 'vless://uuid@orig.com:443?type=ws&security=tls&flow=xtls-rprx-vision#cfg'
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    expect(generateConfigs(parseAll(raw), ['1.1.1.1'], opts)).toEqual([])
  })

  it('a flow config with VLESS Encryption is generated, flow intact', () => {
    const raw = 'vless://uuid@orig.com:443?type=ws&security=tls&flow=xtls-rprx-vision&encryption=mlkem768x25519plus.native.0rtt.abc#cfg'
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(parseAll(raw), ['1.1.1.1'], opts)
    expect(out.length).toBe(1)
    expect(out[0]).toMatch(/flow=xtls-rprx-vision/)
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

  it('V7, V15: random SNI strips subdomain, uses root domain only', () => {
    const configs = parseAll('vless://uuid@info.example.com:443?type=ws#cfg')
    const cdnList = ['1.1.1.1']
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'], randomSni: true }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out[0]).toMatch(/sni=[a-z0-9]+\.example\.com\./)
    expect(out[0]).not.toMatch(/sni=[a-z0-9]+\.info\.example/)
    // Anchored: the unterminated form matched `host=info.example.com.` too, so it
    // could not see the trailing dot V15 forbids. The negative states the
    // invariant directly — under random SNI the dot belongs to `sni` alone.
    expect(out[0]).toMatch(/host=info\.example\.com(?=[&#]|$)/)
    expect(out[0]).not.toMatch(/host=[^&#]*\.(?=[&#]|$)/)
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

  it('vless links write host equal to the routing subdomain in both modes', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws&host=route.example.com#cfg')
    const cdnList = ['9.9.9.9']
    const opts = { enableTls: true, enableNoTls: true, noTlsPorts: [80], tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, cdnList, opts)
    expect(out.length).toBe(2)
    for (const link of out) {
      expect(link).toMatch(/host=route\.example\.com/)
      expect(link).not.toMatch(/1\.2\.3\.4/)
    }
  })

  // There is no TLS handshake without TLS, so there is no server name to
  // indicate. The origin config had no sni either.
  it('V3: sni is written under TLS and absent without it', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws&host=route.example.com#cfg')
    const opts = { enableTls: true, enableNoTls: true, noTlsPorts: [80], tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const [noTls, tls] = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(noTls).toMatch(/security=none/)
    expect(noTls).not.toMatch(/sni=/)
    expect(tls).toMatch(/sni=route\.example\.com/)
  })

  it('V3: vmess carries sni under TLS only', () => {
    const obj = { v: '2', ps: 'm', add: '1.2.3.4', port: 443, id: 'uuid', net: 'ws', host: 'route.example.com', tls: 'tls' }
    const configs = parseAll('vmess://' + btoa(JSON.stringify(obj)))
    const opts = { enableTls: false, enableNoTls: true, noTlsPorts: [80], alpn: [], fingerprint: [] }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    const decoded = readVmess(out[0])
    expect(decoded.tls).toBe('none')
    expect(decoded.sni).toBeUndefined()
  })

  // The payload a client reads is base64 of UTF-8 JSON bytes. Percent-encoding
  // the JSON before base64 — what this builder used to do — hands the client a
  // string starting `%7B` instead of an object, and no vmess link this tool ever
  // produced opened anywhere.
  it('writes a vmess payload a client reads with one base64 step', () => {
    const obj = { v: '2', ps: 'm', add: '1.2.3.4', port: 443, id: 'uuid', net: 'ws', host: 'route.example.com', tls: 'tls' }
    const configs = parseAll('vmess://' + btoa(JSON.stringify(obj)))
    const out = generateConfigs(configs, ['9.9.9.9'], { enableTls: false, enableNoTls: true, noTlsPorts: [80], alpn: [], fingerprint: [] })
    const payload = atob(out[0].replace('vmess://', ''))
    expect(payload.startsWith('{')).toBe(true)
    expect(payload).not.toMatch(/%[0-9A-Fa-f]{2}/)
    expect(JSON.parse(payload).add).toBe('9.9.9.9')
  })

  it('AE1: a Persian and emoji remark survives the payload encoding', () => {
    const obj = { v: '2', ps: 'سرور تهران 🚀', add: '1.2.3.4', port: 443, id: 'uuid', net: 'ws', host: 'route.example.com', tls: 'tls' }
    const configs = parseAll('vmess://' + encodeBase64(JSON.stringify(obj)))
    const out = generateConfigs(configs, ['9.9.9.9'], { enableTls: false, enableNoTls: true, noTlsPorts: [80], alpn: [], fingerprint: [] })
    const decoded = readVmess(out[0])
    expect(decoded.ps).toBe('سرور تهران 🚀-001')
    expect(decoded.ps).not.toMatch(/%[0-9A-Fa-f]{2}/)
  })

  // The remark is decoded on the way in, so it has to be encoded on the way out
  // or a link round-tripped through the tool comes back with a raw space and
  // raw multi-byte characters in its fragment.
  it('encodes the remark it writes into the fragment', () => {
    const configs = parseAll('vless://uuid@x.com:443?type=ws#%F0%9F%87%A9%F0%9F%87%AA%20SS')
    const opts = { enableTls: false, enableNoTls: true, noTlsPorts: [80], alpn: [], fingerprint: [] }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(out[0]).toMatch(/#%F0%9F%87%A9%F0%9F%87%AA%20SS-001$/)
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
    const decoded = readVmess(out[0])
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
    expect(out[0]).toMatch(/host=info\.example\.com(?=[&#]|$)/)
  })

  // The validation gate rejects a trailing dot before generation, but the root
  // extraction must not rely on it: `example.com.` used to split to a trailing
  // empty label, yielding the root `com.` and an SNI of `rand.com..`.
  it('V7, V15: a trailing dot in the routing subdomain does not corrupt the root domain', () => {
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

  it('ss links are rewritten like vless, credential segment untouched', () => {
    const userinfo = 'YWVzLTI1Ni1nY206cGFzc3dvcmQ'
    const configs = parseAll(`ss://${userinfo}@1.2.3.4:443?type=ws&host=route.example.com#cfg`)
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    const out = generateConfigs(configs, ['9.9.9.9'], opts)
    expect(out[0]).toBe(
      `ss://${userinfo}@9.9.9.9:443?type=ws&host=route.example.com&security=tls&sni=route.example.com&insecure=0&allowInsecure=0&alpn=h2&fp=chrome#cfg-001`
    )
  })

  // ss carries ALPN and fingerprint exactly as vless does, so the combos are
  // real links rather than duplicates (ADR-0005).
  it('ss multiplies over ALPN and fingerprint like every other scheme', () => {
    const configs = parseAll('ss://YWVzOnB3@x.com:443?type=ws#cfg')
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2', 'http/1.1'], fingerprint: ['chrome', 'firefox'] }
    expect(generateConfigs(configs, ['1.1.1.1'], opts).length).toBe(4)
  })

  it('an ss plugin link never reaches the output', () => {
    const configs = parseAll('ss://YWVzOnB3@x.com:443?plugin=xray-plugin%3Bmode%3Dwebsocket#cfg')
    const opts = { enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'] }
    expect(generateConfigs(configs, ['1.1.1.1'], opts)).toEqual([])
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
