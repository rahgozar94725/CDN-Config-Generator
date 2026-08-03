import { describe, it, expect } from 'vitest'
import { configFingerprint, resolveRoutingSubdomain, isProcessedConfig, findMissingRoutingSubdomain } from './rows.js'
import { parseConfig } from './parser.js'

function parseAll(lines) {
  return lines.split('\n').filter(Boolean).map(parseConfig)
}

describe('configFingerprint', () => {
  it('is stable across remark edits but changes with the endpoint', () => {
    const a = parseConfig('vless://uuid@1.2.3.4:443?type=ws#remarkA')
    const b = parseConfig('vless://uuid@1.2.3.4:443?type=ws#remarkB')
    const c = parseConfig('vless://uuid@1.2.3.4:8443?type=ws#remarkA')
    expect(configFingerprint(a)).toBe(configFingerprint(b))
    expect(configFingerprint(a)).not.toBe(configFingerprint(c))
  })

  it('is deterministic and safe for malformed / missing config', () => {
    expect(configFingerprint(null)).toBe('')
    expect(configFingerprint(undefined)).toBe('')
    expect(typeof configFingerprint(parseConfig('vless://a@x.com:443?type=ws#a'))).toBe('string')
  })
})

describe('resolveRoutingSubdomain', () => {
  const hostname = parseConfig('vless://a@host.example.com:443?type=ws#a')
  const required = parseConfig('vless://b@1.2.3.4:443?type=ws#b')

  it('returns the derived value when no override exists', () => {
    expect(resolveRoutingSubdomain(hostname, new Map())).toBe('host.example.com')
  })

  it('returns empty for an unsatisfied required config with no override', () => {
    expect(resolveRoutingSubdomain(required, new Map())).toBe('')
  })

  it('a non-empty override wins over the derived value', () => {
    const overrides = new Map([[configFingerprint(hostname), 'route.example.com']])
    expect(resolveRoutingSubdomain(hostname, overrides)).toBe('route.example.com')
  })

  it('an empty or whitespace override falls back to the derived value', () => {
    expect(resolveRoutingSubdomain(hostname, new Map([[configFingerprint(hostname), '   ']]))).toBe('host.example.com')
    expect(resolveRoutingSubdomain(hostname, new Map([[configFingerprint(hostname), '']]))).toBe('host.example.com')
  })

  it('an override satisfies a previously-required config', () => {
    const overrides = new Map([[configFingerprint(required), 'route.example.com']])
    expect(resolveRoutingSubdomain(required, overrides)).toBe('route.example.com')
  })
})

describe('isProcessedConfig', () => {
  it('true only for allowed transports', () => {
    expect(isProcessedConfig(parseConfig('vless://a@x.com:443?type=ws#a'))).toBe(true)
    expect(isProcessedConfig(parseConfig('vless://a@x.com:443?type=grpc#a'))).toBe(true)
    expect(isProcessedConfig(parseConfig('vless://a@x.com:443?type=tcp#a'))).toBe(false)
    expect(isProcessedConfig(null)).toBe(false)
  })
})

describe('findMissingRoutingSubdomain', () => {
  it('flags a config whose required field is empty', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws#cfg')
    const missing = findMissingRoutingSubdomain(configs)
    expect(missing.length).toBe(1)
    expect(missing[0].index).toBe(0)
    expect(missing[0].config.raw).toBe('vless://uuid@1.2.3.4:443?type=ws#cfg')
  })

  it('returns empty for configs with a derivable routing subdomain', () => {
    const configs = parseAll(
      'vless://a@host.com:443?type=ws#a\n' +
      'trojan://b@1.2.3.4:443?type=ws&host=route.example.com#b'
    )
    expect(findMissingRoutingSubdomain(configs)).toEqual([])
  })

  it('flags only the invalid rows in a mixed batch', () => {
    const configs = parseAll(
      'vless://a@host.com:443?type=ws#a\n' +
      'vless://b@1.2.3.4:443?type=ws#b\n' +
      'vless://c@5.6.7.8:443?type=ws#c'
    )
    const missing = findMissingRoutingSubdomain(configs)
    expect(missing.map(m => m.index)).toEqual([1, 2])
  })

  it('never flags pass-through configs even with an IP address', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=tcp#cfg')
    expect(findMissingRoutingSubdomain(configs)).toEqual([])
  })

  it('flags a whitespace-only routing subdomain as empty', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws#cfg')
    configs[0].routingSubdomain = '   '
    expect(findMissingRoutingSubdomain(configs).length).toBe(1)
  })

  it('skips unparseable entries', () => {
    const missing = findMissingRoutingSubdomain([null, parseConfig('vless://a@host.com:443?type=ws#a')])
    expect(missing).toEqual([])
  })

  it('does not flag a config satisfied by a non-empty override (resolved row)', () => {
    const config = parseConfig('vless://uuid@1.2.3.4:443?type=ws#cfg') // required, empty
    const resolved = { ...config, routingSubdomain: resolveRoutingSubdomain(config, new Map([[configFingerprint(config), 'route.example.com']])) }
    expect(findMissingRoutingSubdomain([resolved])).toEqual([])
  })
})
