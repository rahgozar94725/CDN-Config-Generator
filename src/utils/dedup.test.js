import { describe, it, expect } from 'vitest'
import { dedupeAndNumber, linkIdentity } from './dedup.js'
import { parseRows } from './generation.js'
import { generateConfigs } from './multiplier.js'

function vmess(ps, add = '1.1.1.1') {
  const obj = { v: '2', ps, add, port: 443, id: 'uuid', net: 'ws', host: 'x.com', tls: 'tls' }
  return 'vmess://' + btoa(encodeURIComponent(JSON.stringify(obj)))
}

function decodeVmess(link) {
  return JSON.parse(decodeURIComponent(atob(link.replace('vmess://', ''))))
}

// Entries carry the base remark explicitly, never guessed from the link
// (dedup.js: a genuine remark ending in digits must not be truncated).
function q(link, remark) {
  return { link, remark }
}

describe('linkIdentity', () => {
  it('is order-insensitive on query pairs', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#one'
    const b = 'vless://u@1.1.1.1:443?security=tls&host=x.com&type=ws#two'
    expect(linkIdentity(a)).toBe(linkIdentity(b))
  })

  it('excludes the remark fragment from identity', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#cfg-001'
    const b = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#cfg-002'
    expect(linkIdentity(a)).toBe(linkIdentity(b))
  })

  it('differs when address, port or a query value differ', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#a'
    const b = 'vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls#a'
    const c = 'vless://u@1.1.1.1:8443?type=ws&host=x.com&security=tls#a'
    const d = 'vless://u@1.1.1.1:443?type=ws&host=y.com&security=tls#a'
    expect(linkIdentity(a)).not.toBe(linkIdentity(b))
    expect(linkIdentity(a)).not.toBe(linkIdentity(c))
    expect(linkIdentity(a)).not.toBe(linkIdentity(d))
  })

  it('vmess drops ps and is order-insensitive on the decoded fields', () => {
    expect(linkIdentity(vmess('one'))).toBe(linkIdentity(vmess('two')))
  })
})

describe('dedupeAndNumber', () => {
  it('returns deduplicated, first-wins links for reordered-query duplicates', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#one'
    const b = 'vless://u@1.1.1.1:443?security=tls&host=x.com&type=ws#two'
    const { links, dropped } = dedupeAndNumber([q(a, 'one'), q(b, 'two')])
    expect(links).toHaveLength(1)
    expect(dropped).toBe(1)
    expect(links[0]).toMatch(/#one-001$/)
  })

  it('collapses links that differ only in their remark label', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#cfg-001'
    const b = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#cfg-002'
    const { links, dropped } = dedupeAndNumber([q(a, 'cfg'), q(b, 'cfg')])
    expect(links).toHaveLength(1)
    expect(dropped).toBe(1)
    expect(links[0]).toMatch(/#cfg-001$/)
  })

  it('keeps distinct identities', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls#a'
    const b = 'vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls#a'
    const { links, dropped } = dedupeAndNumber([q(a, 'a'), q(b, 'a')])
    expect(links).toHaveLength(2)
    expect(dropped).toBe(0)
  })

  it('deduplicates vmess links by dropping ps', () => {
    const { links, dropped } = dedupeAndNumber([q(vmess('one'), 'one'), q(vmess('two'), 'two')])
    expect(links).toHaveLength(1)
    expect(dropped).toBe(1)
    expect(decodeVmess(links[0]).ps).toBe('one-001')
  })

  it('numbers per distinct remark text, each label restarting at 001', () => {
    const links = [
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', 'cfg'),
      q('vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls', 'cfg'),
      q('vless://u@3.3.3.3:443?type=ws&host=y.com&security=tls', 'other'),
      q('vless://u@4.4.4.4:443?type=ws&host=y.com&security=tls', 'other'),
    ]
    const { links: out, dropped } = dedupeAndNumber(links)
    expect(dropped).toBe(0)
    expect(out[0]).toMatch(/#cfg-001$/)
    expect(out[1]).toMatch(/#cfg-002$/)
    expect(out[2]).toMatch(/#other-001$/)
    expect(out[3]).toMatch(/#other-002$/)
  })

  it('treats two remarks that differ only in a trailing number as distinct', () => {
    const links = [
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', 'server-123'),
      q('vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls', 'server'),
    ]
    const { links: out, dropped } = dedupeAndNumber(links)
    expect(dropped).toBe(0)
    expect(out[0]).toMatch(/#server-123-001$/)
    expect(out[1]).toMatch(/#server-001$/)
  })

  it('gives configs with no remark the shared config- sequence', () => {
    const links = [
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', ''),
      q('vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls', ''),
    ]
    const { links: out, dropped } = dedupeAndNumber(links)
    expect(dropped).toBe(0)
    expect(out[0]).toMatch(/#config-001$/)
    expect(out[1]).toMatch(/#config-002$/)
  })

  it('numbers without gaps within a label after dropping duplicates', () => {
    const links = [
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', 'cfg'),
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', 'cfg'),
      q('vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls', 'cfg'),
    ]
    const { links: out, dropped } = dedupeAndNumber(links)
    expect(dropped).toBe(1)
    expect(out[0]).toMatch(/#cfg-001$/)
    expect(out[1]).toMatch(/#cfg-002$/)
  })

  it('re-encodes a non-ASCII remark fragment', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls'
    const { links } = dedupeAndNumber([q(a, '🇩🇪 SS')])
    expect(links[0]).toMatch(/#%F0%9F%87%A9%F0%9F%87%AA%20SS-001$/)
  })

  it('numbers vmess per remark text, distinct remarks restart', () => {
    const links = [
      q(vmess('a', '1.1.1.1'), 'a'),
      q(vmess('a', '2.2.2.2'), 'a'),
      q(vmess('b', '3.3.3.3'), 'b'),
    ]
    const { links: out, dropped } = dedupeAndNumber(links)
    expect(dropped).toBe(0)
    expect(decodeVmess(out[0]).ps).toBe('a-001')
    expect(decodeVmess(out[1]).ps).toBe('a-002')
    expect(decodeVmess(out[2]).ps).toBe('b-001')
  })

  it('dedupes through the multiplier pipeline over identical generated links', () => {
    const raw = 'vless://u@x.com:443?type=ws&host=route.example.com#a\n' +
      'vless://u@x.com:443?type=ws&host=route.example.com#b'
    const rows = parseRows(raw)
    const built = generateConfigs(rows, ['1.1.1.1'], {
      enableTls: true, enableNoTls: false, tlsPorts: [443], alpn: ['h2'], fingerprint: ['chrome'],
    })
    expect(built).toHaveLength(2)
    const entries = rows.map((row, i) => ({ link: built[i], remark: row.remark }))
    const { links, dropped } = dedupeAndNumber(entries)
    expect(links).toHaveLength(1)
    expect(dropped).toBe(1)
    expect(links[0]).toMatch(/#a-001$/)
  })
})
