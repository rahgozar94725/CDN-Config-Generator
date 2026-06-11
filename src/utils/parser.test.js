import { describe, it, expect } from 'vitest'
import { parseConfig, parseVless, parseVmess, parseTrojan } from './parser.js'

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

  it('returns null for unknown protocol', () => {
    expect(parseConfig('ss://something')).toBeNull()
  })
})
