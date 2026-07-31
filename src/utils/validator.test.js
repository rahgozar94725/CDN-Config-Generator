import { describe, it, expect } from 'vitest'
import { findMissingRoutingSubdomain } from './validator.js'
import { parseConfig } from './parser.js'

function parseAll(lines) {
  return lines.split('\n').filter(Boolean).map(parseConfig)
}

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
})
