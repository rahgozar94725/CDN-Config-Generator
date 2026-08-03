import { describe, it, expect } from 'vitest'
import { parseConfig, parseVless, parseVmess, parseTrojan, parseSs } from './parser.js'

describe('parseVless', () => {
  it('parses standard vless with ws+tls', () => {
    const r = parseVless('vless://uuid@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws#my-config')
    expect(r).not.toBeNull()
    expect(r.type).toBe('vless')
    expect(r.uuid).toBe('uuid')
    expect(r.address).toBe('example.com')
    expect(r.port).toBe(443)
    expect(r.transport).toBe('ws')
    expect(r.security).toBe('tls')
    expect(r.remark).toBe('my-config')
    expect(r.params.host).toBe('example.com')
    expect(r.params.path).toBe('/ws')
  })

  it('parses without fragment', () => {
    const r = parseVless('vless://uuid@example.com:80?type=ws&security=none')
    expect(r).not.toBeNull()
    expect(r.remark).toBe('')
    expect(r.port).toBe(80)
  })

  it('returns null for invalid URL', () => {
    expect(parseVless('not a url')).toBeNull()
  })
})

describe('parseVmess', () => {
  it('parses standard vmess base64 config', () => {
    const obj = { v: '2', ps: 'my-config', add: 'example.com', port: '443', id: 'uuid', aid: '0', net: 'ws', type: 'none', host: 'example.com', path: '/ws', tls: 'tls' }
    const b64 = btoa(JSON.stringify(obj))
    const r = parseVmess('vmess://' + b64)
    expect(r).not.toBeNull()
    expect(r.type).toBe('vmess')
    expect(r.uuid).toBe('uuid')
    expect(r.address).toBe('example.com')
    expect(r.port).toBe(443)
    expect(r.transport).toBe('ws')
    expect(r.security).toBe('tls')
    expect(r.remark).toBe('my-config')
    expect(r.params.host).toBe('example.com')
    expect(r.params.path).toBe('/ws')
  })

  it('parses vmess without tls', () => {
    const obj = { v: '2', ps: 'test', add: 'x.com', port: 80, id: 'id', net: 'ws', tls: 'none' }
    const r = parseVmess('vmess://' + btoa(JSON.stringify(obj)))
    expect(r.security).toBe('none')
  })

  it('returns null for invalid base64', () => {
    expect(parseVmess('vmess://!!!')).toBeNull()
  })
})

describe('parseTrojan', () => {
  it('parses standard trojan config', () => {
    const r = parseTrojan('trojan://password@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws#my-config')
    expect(r).not.toBeNull()
    expect(r.type).toBe('trojan')
    expect(r.uuid).toBe('password')
    expect(r.address).toBe('example.com')
    expect(r.port).toBe(443)
    expect(r.transport).toBe('ws')
    expect(r.security).toBe('tls')
    expect(r.remark).toBe('my-config')
  })
})

describe('parseSs', () => {
  const userinfo = 'YWVzLTI1Ni1nY206cGFzc3dvcmQ'

  it('parses the Xray-native dialect like any query-string link', () => {
    const r = parseSs(`ss://${userinfo}@example.com:443?type=ws&security=tls&host=route.example.com&path=%2Fws&fp=chrome&alpn=h2#my-config`)
    expect(r.type).toBe('ss')
    expect(r.address).toBe('example.com')
    expect(r.port).toBe(443)
    expect(r.transport).toBe('ws')
    expect(r.security).toBe('tls')
    expect(r.remark).toBe('my-config')
    expect(r.params.host).toBe('route.example.com')
    expect(r.params.path).toBe('/ws')
  })

  // The credential segment is opaque, so nothing here distinguishes SIP002's
  // base64 from SIP022's percent-encoded method:password — including the colons
  // that would otherwise be read as a username/password split.
  it('carries the credential segment verbatim, base64 or SIP022', () => {
    expect(parseSs(`ss://${userinfo}@x.com:443?type=ws#a`).uuid).toBe(userinfo)
    const sip022 = '2022-blake3-aes-256-gcm:YctPZ6U7xPPcU%2Bgp3u%2B0tx%2FtRizJN9K8y%2BuKlW2qjlI%3D'
    expect(parseSs(`ss://${sip022}@x.com:443?type=ws#a`).uuid).toBe(sip022)
  })

  it('returns null for the legacy fully-base64 form, which states no transport', () => {
    expect(parseSs('ss://YWVzOnB3QDEuMi4zLjQ6NDQz#tag')).toBeNull()
    expect(parseSs('ss://nope')).toBeNull()
  })

  it('derives the routing subdomain from host, then from a hostname address', () => {
    expect(parseSs(`ss://${userinfo}@connect.example.com:443?type=ws#a`).routingSubdomain).toBe('connect.example.com')
    expect(parseSs(`ss://${userinfo}@1.2.3.4:443?type=ws#a`).routingSubdomainRequired).toBe(true)
  })
})

describe('routing subdomain derivation', () => {
  it('hostname address without host param → address used, not required', () => {
    const r = parseVless('vless://uuid@connect.example.com:443?type=ws#cfg')
    expect(r.routingSubdomain).toBe('connect.example.com')
    expect(r.routingSubdomainRequired).toBe(false)
  })

  it('explicit host param wins over differing hostname address', () => {
    const r = parseVless('vless://uuid@connect.example.com:443?type=ws&host=routing.example.com#cfg')
    expect(r.routingSubdomain).toBe('routing.example.com')
    expect(r.routingSubdomainRequired).toBe(false)
  })

  it('IP address with host param → host used, not required', () => {
    const r = parseTrojan('trojan://pw@1.2.3.4:443?type=ws&host=route.example.com#cfg')
    expect(r.routingSubdomain).toBe('route.example.com')
    expect(r.routingSubdomainRequired).toBe(false)
  })

  it('IP address without host param → empty and required', () => {
    const r = parseVless('vless://uuid@1.2.3.4:443?type=ws#cfg')
    expect(r.routingSubdomain).toBe('')
    expect(r.routingSubdomainRequired).toBe(true)
  })

  it('input sni param never consulted for derivation', () => {
    const r = parseVless('vless://uuid@connect.example.com:443?type=ws&sni=bypass.foo#cfg')
    expect(r.routingSubdomain).toBe('connect.example.com')
    expect(r.routingSubdomainRequired).toBe(false)
  })

  it('IP address with sni param but no host param → still empty and required', () => {
    const r = parseVless('vless://uuid@1.2.3.4:443?type=ws&sni=bypass.foo#cfg')
    expect(r.routingSubdomain).toBe('')
    expect(r.routingSubdomainRequired).toBe(true)
  })

  it('IPv6 address without host param → empty and required', () => {
    const r = parseVless('vless://uuid@[2001:db8::1]:443?type=ws#cfg')
    expect(r.routingSubdomain).toBe('')
    expect(r.routingSubdomainRequired).toBe(true)
  })

  it('vmess uses JSON host field when present', () => {
    const obj = { v: '2', ps: 'm', add: '1.2.3.4', port: 443, id: 'uuid', net: 'ws', host: 'route.example.com', tls: 'tls' }
    const r = parseVmess('vmess://' + btoa(JSON.stringify(obj)))
    expect(r.routingSubdomain).toBe('route.example.com')
    expect(r.routingSubdomainRequired).toBe(false)
  })

  it('vmess IP without host → empty and required', () => {
    const obj = { v: '2', ps: 'm', add: '1.2.3.4', port: 443, id: 'uuid', net: 'ws', tls: 'tls' }
    const r = parseVmess('vmess://' + btoa(JSON.stringify(obj)))
    expect(r.routingSubdomain).toBe('')
    expect(r.routingSubdomainRequired).toBe(true)
  })
})

describe('parseConfig', () => {
  it('routes vless:// correctly', () => {
    const r = parseConfig('vless://uuid@x.com:443?type=ws#test')
    expect(r.type).toBe('vless')
  })

  it('routes vmess:// correctly', () => {
    const obj = { v: '2', ps: 't', add: 'x.com', port: 80, id: 'id', net: 'ws' }
    const r = parseConfig('vmess://' + btoa(JSON.stringify(obj)))
    expect(r.type).toBe('vmess')
  })

  it('routes trojan:// correctly', () => {
    const r = parseConfig('trojan://pw@x.com:443?type=ws#test')
    expect(r.type).toBe('trojan')
  })

  it('routes ss:// correctly', () => {
    const r = parseConfig('ss://YWVzLTI1Ni1nY206cHc@x.com:443?type=ws#test')
    expect(r.type).toBe('ss')
  })

  it('returns null for unknown protocol', () => {
    expect(parseConfig('hy2://something')).toBeNull()
    expect(parseConfig('ss://something')).toBeNull()
  })
})
