import { describe, it, expect } from 'vitest'
import {
  configFingerprint,
  resolveRoutingSubdomain,
  isProcessedConfig,
  validateRoutingSubdomain,
  findInvalidRoutingSubdomain,
} from './rows.js'
import { parseConfig } from './parser.js'

function parseAll(lines) {
  return lines.split('\n').filter(Boolean).map(parseConfig)
}

function resolved(config, overrides) {
  return { ...config, routingSubdomain: resolveRoutingSubdomain(config, overrides) }
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

  // Presence, not truthiness: clearing the field is a rejection of the derived
  // value, so it must not silently re-derive (ADR-0003).
  it('an empty override wins over the derived value instead of falling back', () => {
    const overrides = new Map([[configFingerprint(hostname), '']])
    expect(resolveRoutingSubdomain(hostname, overrides)).toBe('')
  })

  it('preserves the typed value verbatim, including surrounding whitespace', () => {
    const overrides = new Map([[configFingerprint(hostname), '  route.example.com  ']])
    expect(resolveRoutingSubdomain(hostname, overrides)).toBe('  route.example.com  ')
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

describe('validateRoutingSubdomain', () => {
  it('accepts a plain two-label hostname and deeper subdomains', () => {
    expect(validateRoutingSubdomain('example.com')).toBe(null)
    expect(validateRoutingSubdomain('a.b.c.example.com')).toBe(null)
    expect(validateRoutingSubdomain('my-host.example.com')).toBe(null)
    expect(validateRoutingSubdomain('123.example.com')).toBe(null)
  })

  it('accepts uppercase without altering it', () => {
    expect(validateRoutingSubdomain('Example.COM')).toBe(null)
  })

  it('ignores surrounding whitespace', () => {
    expect(validateRoutingSubdomain('  example.com  ')).toBe(null)
  })

  it('reports empty and whitespace-only as required', () => {
    expect(validateRoutingSubdomain('')).toBe('required')
    expect(validateRoutingSubdomain('   ')).toBe('required')
    expect(validateRoutingSubdomain(null)).toBe('required')
    expect(validateRoutingSubdomain(undefined)).toBe('required')
  })

  it('reports a trailing dot with its own reason so the UI can point at Random SNI', () => {
    expect(validateRoutingSubdomain('example.com.')).toBe('trailingDot')
    expect(validateRoutingSubdomain('example.com..')).toBe('trailingDot')
  })

  it('rejects a single label', () => {
    expect(validateRoutingSubdomain('abc')).toBe('format')
    expect(validateRoutingSubdomain('localhost')).toBe('format')
  })

  it('rejects IP addresses, which the regex alone would accept', () => {
    expect(validateRoutingSubdomain('1.2.3.4')).toBe('format')
    expect(validateRoutingSubdomain('255.255.255.255')).toBe('format')
    expect(validateRoutingSubdomain('2001:db8::1')).toBe('format')
  })

  it('rejects characters that are not letters, digits or hyphens', () => {
    expect(validateRoutingSubdomain('MY_Host.com')).toBe('format')
    expect(validateRoutingSubdomain('bad!!.com')).toBe('format')
    expect(validateRoutingSubdomain('a b.com')).toBe('format')
    expect(validateRoutingSubdomain('%D9%85.com')).toBe('format')
  })

  it('rejects malformed labels', () => {
    expect(validateRoutingSubdomain('-lead.com')).toBe('format')
    expect(validateRoutingSubdomain('trail-.com')).toBe('format')
    expect(validateRoutingSubdomain('a..b.com')).toBe('format')
    expect(validateRoutingSubdomain(`${'a'.repeat(64)}.com`)).toBe('format')
  })

  it('rejects a name longer than 253 characters', () => {
    const long = `${Array.from({ length: 5 }, () => 'a'.repeat(50)).join('.')}.com`
    expect(long.length).toBeGreaterThan(253)
    expect(validateRoutingSubdomain(long)).toBe('format')
  })

  it('rejects punycode and non-ASCII names outright', () => {
    expect(validateRoutingSubdomain('xn--mgbh0fb.xn--mgba3a4f16a')).toBe('format')
    expect(validateRoutingSubdomain('sub.xn--mgba3a4f16a')).toBe('format')
    expect(validateRoutingSubdomain('XN--MGBH0FB.com')).toBe('format')
    expect(validateRoutingSubdomain('مثال.ایران')).toBe('format')
  })
})

describe('findInvalidRoutingSubdomain', () => {
  it('flags a config whose required field is empty', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws#cfg')
    const invalid = findInvalidRoutingSubdomain(configs)
    expect(invalid.length).toBe(1)
    expect(invalid[0].index).toBe(0)
    expect(invalid[0].reason).toBe('required')
    expect(invalid[0].config.raw).toBe('vless://uuid@1.2.3.4:443?type=ws#cfg')
  })

  it('returns empty for configs with a derivable routing subdomain', () => {
    const configs = parseAll(
      'vless://a@host.com:443?type=ws#a\n' +
      'trojan://b@1.2.3.4:443?type=ws&host=route.example.com#b'
    )
    expect(findInvalidRoutingSubdomain(configs)).toEqual([])
  })

  it('flags only the invalid rows in a mixed batch', () => {
    const configs = parseAll(
      'vless://a@host.com:443?type=ws#a\n' +
      'vless://b@1.2.3.4:443?type=ws#b\n' +
      'vless://c@5.6.7.8:443?type=ws#c'
    )
    const invalid = findInvalidRoutingSubdomain(configs)
    expect(invalid.map(m => m.index)).toEqual([1, 2])
  })

  it('never flags pass-through configs even with an IP address', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=tcp#cfg')
    expect(findInvalidRoutingSubdomain(configs)).toEqual([])
  })

  it('flags a whitespace-only routing subdomain as required', () => {
    const configs = parseAll('vless://uuid@1.2.3.4:443?type=ws#cfg')
    configs[0].routingSubdomain = '   '
    expect(findInvalidRoutingSubdomain(configs)[0].reason).toBe('required')
  })

  it('skips unparseable entries', () => {
    const invalid = findInvalidRoutingSubdomain([null, parseConfig('vless://a@host.com:443?type=ws#a')])
    expect(invalid).toEqual([])
  })

  it('does not flag a config satisfied by a non-empty override', () => {
    const config = parseConfig('vless://uuid@1.2.3.4:443?type=ws#cfg')
    const overrides = new Map([[configFingerprint(config), 'route.example.com']])
    expect(findInvalidRoutingSubdomain([resolved(config, overrides)])).toEqual([])
  })

  // The clearing bug: a derivable config whose field was emptied used to pass
  // the gate and generate links carrying the value the user had deleted.
  it('flags a derivable config whose field the user cleared', () => {
    const config = parseConfig('vless://uuid@host.example.com:443?type=ws#cfg')
    const overrides = new Map([[configFingerprint(config), '']])
    const invalid = findInvalidRoutingSubdomain([resolved(config, overrides)])
    expect(invalid.length).toBe(1)
    expect(invalid[0].reason).toBe('required')
  })

  // Same rule regardless of source: an unusable host param blocks exactly as a
  // typed one does.
  it('flags an invalid value that came from derivation, not from typing', () => {
    const configs = parseAll(
      'vless://a@1.2.3.4:443?type=ws&host=abc#single-label\n' +
      'vless://b@1.2.3.4:443?type=ws&host=example.com.#trailing-dot'
    )
    const invalid = findInvalidRoutingSubdomain(configs)
    expect(invalid.map(m => m.reason)).toEqual(['format', 'trailingDot'])
  })
})
