import { describe, it, expect } from 'vitest'
import { dedupeAndNumber, linkIdentity } from './dedup.js'
import { parseRows } from './generation.js'
import { generateConfigs } from './multiplier.js'
import { encodeBase64 } from './parser.js'
import { decodeVmessLink } from './roundtrip.js'

function vmess(ps, add = '1.1.1.1') {
  const obj = { v: '2', ps, add, port: 443, id: 'uuid', net: 'ws', host: 'x.com', tls: 'tls' }
  return 'vmess://' + encodeBase64(JSON.stringify(obj))
}

// Read the payload the way a client does: one base64 step, then JSON. The
// round-trip module's decoder is that read, and it shares nothing with the
// parser these links are also expected to survive, so a second decode step
// cannot creep back in and let a non-standard payload pass as correct.
function decodeVmess(link) {
  return decodeVmessLink(link).params
}

// Entries carry the base remark explicitly, never guessed from the link
// (dedup.js: a genuine remark ending in digits must not be truncated).
function q(link, remark) {
  return { link, remark }
}

// The payload shape this generator used to write: base64 of percent-encoded
// JSON. Hard-coded literals rather than built by encoding, so no helper in this
// repo can produce the old shape — these two differ only in `ps`, which is what
// makes them the pair the dropped tolerance used to collapse (ADR-0007).
const OLD_SHAPE_ONE = 'vmess://JTdCJTIydiUyMiUzQSUyMjIlMjIlMkMlMjJwcyUyMiUzQSUyMm9uZSUyMiUyQyUyMmFkZCUyMiUzQSUyMjEuMS4xLjElMjIlMkMlMjJwb3J0JTIyJTNBNDQzJTJDJTIyaWQlMjIlM0ElMjJ1dWlkJTIyJTJDJTIybmV0JTIyJTNBJTIyd3MlMjIlMkMlMjJob3N0JTIyJTNBJTIyeC5jb20lMjIlMkMlMjJ0bHMlMjIlM0ElMjJ0bHMlMjIlN0Q='
const OLD_SHAPE_TWO = 'vmess://JTdCJTIydiUyMiUzQSUyMjIlMjIlMkMlMjJwcyUyMiUzQSUyMnR3byUyMiUyQyUyMmFkZCUyMiUzQSUyMjEuMS4xLjElMjIlMkMlMjJwb3J0JTIyJTNBNDQzJTJDJTIyaWQlMjIlM0ElMjJ1dWlkJTIyJTJDJTIybmV0JTIyJTNBJTIyd3MlMjIlMkMlMjJob3N0JTIyJTNBJTIyeC5jb20lMjIlMkMlMjJ0bHMlMjIlM0ElMjJ0bHMlMjIlN0Q='

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

  // A random SNI is a nonce: it is regenerated per built link, so keeping it in
  // identity means no two links ever match and dedup is off for anyone with the
  // option on. Dropping it is safe because `host` still carries the routing
  // subdomain unrandomised, so two different routings stay apart (ADR-0006).
  it('ignores sni under random SNI, but keeps host distinguishing', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls&sni=aaa.x.com.#one'
    const b = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls&sni=bbb.x.com.#two'
    const c = 'vless://u@1.1.1.1:443?type=ws&host=y.com&security=tls&sni=aaa.y.com.#three'
    expect(linkIdentity(a, { randomSni: true })).toBe(linkIdentity(b, { randomSni: true }))
    expect(linkIdentity(a, { randomSni: true })).not.toBe(linkIdentity(c, { randomSni: true }))
  })

  it('keeps sni in identity when the SNI is not random', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls&sni=a.x.com#one'
    const b = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls&sni=b.x.com#two'
    expect(linkIdentity(a)).not.toBe(linkIdentity(b))
  })

  it('ignores the vmess sni field under random SNI', () => {
    const vm = sni => 'vmess://' + encodeBase64(JSON.stringify(
      { v: '2', ps: 'a', add: '1.1.1.1', port: 443, id: 'uuid', net: 'ws', host: 'x.com', tls: 'tls', sni }
    ))
    expect(linkIdentity(vm('aaa.x.com.'), { randomSni: true }))
      .toBe(linkIdentity(vm('bbb.x.com.'), { randomSni: true }))
    expect(linkIdentity(vm('aaa.x.com.'))).not.toBe(linkIdentity(vm('bbb.x.com.')))
  })

  // An undecodable link states no identity, so it can only be its own byte-equal
  // twin. Collapsing every undecodable vmess link into one empty identity would
  // drop links that share nothing but being unreadable.
  it('falls back to the whole link when vmess does not decode', () => {
    const a = 'vmess://not-base64-at-all'
    const b = 'vmess://also-not-base64'
    expect(linkIdentity(a)).not.toBe(linkIdentity(b))
    expect(linkIdentity(a)).toBe(linkIdentity(a))
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

  // The label is `remark || 'config'`, so keying the counter on the remark text
  // gave an empty remark and a remark of literally `config` two counters writing
  // into one label space — two links, both `config-001`. Keyed on the label base,
  // uniqueness is structural.
  it('shares one sequence between no remark and a remark of config', () => {
    const links = [
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', ''),
      q('vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls', 'config'),
      q('vless://u@3.3.3.3:443?type=ws&host=x.com&security=tls', undefined),
    ]
    const { links: out } = dedupeAndNumber(links)
    expect(out[0]).toMatch(/#config-001$/)
    expect(out[1]).toMatch(/#config-002$/)
    expect(out[2]).toMatch(/#config-003$/)
  })

  // A bare object reads its counter through Object.prototype, so a remark naming
  // a prototype member returned a function instead of 0 and the suffix became the
  // function's source text.
  it('numbers remarks that name Object.prototype members', () => {
    const links = [
      q('vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls', 'constructor'),
      q('vless://u@2.2.2.2:443?type=ws&host=x.com&security=tls', 'constructor'),
      q('vless://u@3.3.3.3:443?type=ws&host=x.com&security=tls', 'toString'),
      q('vless://u@4.4.4.4:443?type=ws&host=x.com&security=tls', '__proto__'),
    ]
    const { links: out } = dedupeAndNumber(links)
    expect(out[0]).toMatch(/#constructor-001$/)
    expect(out[1]).toMatch(/#constructor-002$/)
    expect(out[2]).toMatch(/#toString-001$/)
    expect(out[3]).toMatch(/#__proto__-001$/)
  })

  it('collapses links that differ only in a random sni when told the SNI is random', () => {
    const a = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls&sni=aaa.x.com.'
    const b = 'vless://u@1.1.1.1:443?type=ws&host=x.com&security=tls&sni=bbb.x.com.'
    const off = dedupeAndNumber([q(a, 'cfg'), q(b, 'cfg')])
    expect(off.links).toHaveLength(2)
    expect(off.dropped).toBe(0)
    const on = dedupeAndNumber([q(a, 'cfg'), q(b, 'cfg')], { randomSni: true })
    expect(on.links).toHaveLength(1)
    expect(on.dropped).toBe(1)
    // The survivor keeps its own random SNI: only identity is canonicalised.
    expect(on.links[0]).toMatch(/sni=aaa\.x\.com\./)
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

// The read side of the clean break (ADR-0007). No vmess link this tool ever
// emitted opened in a client, so the old shape has no working links to protect;
// tolerating it on read only kept the broken shape alive inside the pipeline.
describe('the old percent-encoded payload shape', () => {
  it('states no identity, so it matches only a byte-identical twin', () => {
    expect(linkIdentity(OLD_SHAPE_ONE)).toBe(`vmess:${OLD_SHAPE_ONE}`)
    expect(linkIdentity(OLD_SHAPE_ONE)).toBe(linkIdentity(OLD_SHAPE_ONE))
    expect(linkIdentity(OLD_SHAPE_ONE)).not.toBe(linkIdentity(OLD_SHAPE_TWO))
  })

  // The accepted cost of the break, asserted so it reads as deliberate: with the
  // dual-shape tolerance gone, two old-shape links differing only in their label
  // are two survivors instead of one.
  it('no longer collapses two old-shape links differing only in ps', () => {
    const { links, dropped } = dedupeAndNumber([q(OLD_SHAPE_ONE, 'cfg'), q(OLD_SHAPE_TWO, 'cfg')])
    expect(links).toHaveLength(2)
    expect(dropped).toBe(0)
  })

  it('keeps its label unchanged under numbering instead of throwing', () => {
    expect(() => dedupeAndNumber([q(OLD_SHAPE_ONE, 'cfg')])).not.toThrow()
    const { links } = dedupeAndNumber([q(OLD_SHAPE_ONE, 'cfg')])
    expect(links[0]).toBe(OLD_SHAPE_ONE)
  })

  // Valid base64 of valid JSON that is not an object. It decodes and parses
  // without throwing, so only a shape check stops it: writing `ps` onto a
  // number throws mid-numbering and costs the whole run, and an array takes the
  // assignment and drops it again at re-encode, losing the label silently.
  it('treats a payload that is not a JSON object as unreadable, not as a config', () => {
    for (const payload of ['123', '"text"', '["a"]', 'null']) {
      const link = 'vmess://' + encodeBase64(payload)
      expect(() => dedupeAndNumber([q(link, 'cfg')])).not.toThrow()
      expect(dedupeAndNumber([q(link, 'cfg')]).links[0]).toBe(link)
      expect(linkIdentity(link)).toBe(`vmess:${link}`)
    }
  })

  it('does not stop a standard-shape link in the same run from being numbered', () => {
    const { links, dropped } = dedupeAndNumber([q(OLD_SHAPE_ONE, 'cfg'), q(vmess('cfg'), 'cfg')])
    expect(dropped).toBe(0)
    expect(links[0]).toBe(OLD_SHAPE_ONE)
    expect(decodeVmess(links[1]).ps).toBe('cfg-002')
  })
})
