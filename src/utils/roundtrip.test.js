import { beforeAll, describe, it, expect } from 'vitest'
import { parseConfig } from './parser.js'
import { generateLinks, parseRows } from './generation.js'
import {
  EXPECT,
  INTENDED_FIELDS,
  SCHEMES,
  decodeLink,
  decodeQueryLink,
  decodeSsLink,
  decodeVmessLink,
  intendedFields,
  randomSniPattern,
  roundTripContext,
} from './roundtrip.js'

// Links are hand-written here, never built by `src/utils/multiplier.js`. The
// module is the specification of what the builder must write, so borrowing the
// builder to produce the fixtures would only assert that it equals itself — and
// it would couple this unit to the encoding fix landing elsewhere.
function vmessLink(config) {
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  return 'vmess://' + btoa(String.fromCharCode(...bytes))
}

// The old, non-standard payload — base64 of a percent-encoded JSON string. A
// hard-coded literal on purpose: building it by encoding would put the shape
// this project is removing back into the test suite. This is a refusal fixture,
// never an expected shape.
const OLD_SHAPE_PAYLOAD = 'JTdCJTIydiUyMiUzQSUyMjIlMjIlMkMlMjJwcyUyMiUzQSUyMm9sZC1zaGFwZS0wMDElMjIlMkMlMjJhZGQlMjIlM0ElMjIxLjEuMS4xJTIyJTJDJTIycG9ydCUyMiUzQSUyMjQ0MyUyMiUyQyUyMmlkJTIyJTNBJTIydXVpZCUyMiUyQyUyMm5ldCUyMiUzQSUyMndzJTIyJTJDJTIyaG9zdCUyMiUzQSUyMnguZXhhbXBsZS5jb20lMjIlMkMlMjJwYXRoJTIyJTNBJTIyJTIyJTJDJTIydGxzJTIyJTNBJTIydGxzJTIyJTdE'

describe('decodeVmessLink', () => {
  it('reads a standard-shape payload as a plain base64-then-JSON read does', () => {
    const config = { v: '2', ps: 'my-config-001', add: '1.2.3.4', port: '443', id: 'uuid', net: 'ws', host: 'x.example.com', path: '/ws', tls: 'tls', sni: 'x.example.com' }
    const decoded = decodeVmessLink(vmessLink(config))
    expect(decoded.params).toEqual(JSON.parse(atob(vmessLink(config).replace('vmess://', ''))))
    expect(decoded.params).toEqual(config)
  })

  it('normalises the connect port to a number and mirrors the top-level fields', () => {
    const decoded = decodeVmessLink(vmessLink({ ps: 'a-001', add: '1.2.3.4', port: '8443', id: 'uuid' }))
    expect(decoded.scheme).toBe('vmess')
    expect(decoded.port).toBe(8443)
    expect(decoded.address).toBe('1.2.3.4')
    expect(decoded.credential).toBe('uuid')
    expect(decoded.remark).toBe('a-001')
  })

  // parseVmess defaults a missing port to 443. This decoder must not agree with
  // it about a value neither of them read, or a port regression passes here.
  it('does not manufacture a default port for a payload that carries none', () => {
    expect(decodeVmessLink(vmessLink({ ps: 'a-001', add: 'x', id: 'u' })).port).toBeUndefined()
    expect(decodeVmessLink(vmessLink({ ps: 'a-001', add: 'x', port: '443', id: 'u' })).port).toBe(443)
  })

  it('leaves an absent key visibly absent instead of defaulting it', () => {
    const decoded = decodeVmessLink(vmessLink({ ps: 'a-001', add: 'x', port: '80', id: 'u', tls: 'none' }))
    expect(decoded.params.sni).toBeUndefined()
    expect(decoded.params.alpn).toBeUndefined()
    expect(decoded.params.fp).toBeUndefined()
    expect('sni' in decoded.params).toBe(false)
  })

  it('refuses an old percent-encoded payload instead of silently succeeding', () => {
    expect(() => decodeVmessLink('vmess://' + OLD_SHAPE_PAYLOAD)).toThrow()
  })

  it('carries a Persian and emoji remark through with no percent-escapes left', () => {
    const decoded = decodeVmessLink(vmessLink({ ps: 'سرور 🚀-001', add: 'x', port: '443', id: 'u' }))
    expect(decoded.remark).toBe('سرور 🚀-001')
    expect(decoded.remark).not.toContain('%')
  })

  it('accepts base64url and missing padding', () => {
    const config = { v: '2', ps: 'سرور 🚀', add: '1.1.1.1', port: '443', id: 'u', net: 'ws', host: 'x.example.com', path: '', tls: 'none' }
    const standard = vmessLink(config).replace('vmess://', '')
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeVmessLink('vmess://' + urlSafe).params).toEqual(config)
  })

  it('throws on a payload that is not base64, not JSON, or not an object', () => {
    expect(() => decodeVmessLink('vmess://!!!not base64!!!')).toThrow()
    expect(() => decodeVmessLink('vmess://' + btoa('not json at all'))).toThrow()
    expect(() => decodeVmessLink('vmess://' + btoa('[1,2,3]'))).toThrow()
  })

  it('throws when the link is not a vmess link', () => {
    expect(() => decodeVmessLink('vless://u@1.1.1.1:443?type=ws')).toThrow()
  })
})

describe('decodeQueryLink', () => {
  const link = 'vless://uuid-1@X.Example.com:8443?type=ws&host=x.example.com&security=tls&sni=x.example.com&insecure=0&allowInsecure=0&alpn=h2&fp=chrome&path=%2Fws%3Fed%3D2048#my%20config-001'

  it('returns address, port, credential and every query parameter', () => {
    const decoded = decodeQueryLink(link)
    expect(decoded.scheme).toBe('vless')
    expect(decoded.credential).toBe('uuid-1')
    expect(decoded.port).toBe(8443)
    expect(decoded.params).toEqual({
      type: 'ws',
      host: 'x.example.com',
      security: 'tls',
      sni: 'x.example.com',
      insecure: '0',
      allowInsecure: '0',
      alpn: 'h2',
      fp: 'chrome',
      path: '/ws?ed=2048',
    })
  })

  it('lowercases the authority host, the way a URL parser does', () => {
    expect(decodeQueryLink(link).address).toBe('x.example.com')
  })

  it('percent-decodes the fragment remark', () => {
    expect(decodeQueryLink(link).remark).toBe('my config-001')
    expect(decodeQueryLink('trojan://pw@1.2.3.4:443?type=ws#%D8%B3%D8%B1%D9%88%D8%B1%20%F0%9F%9A%80-002').remark).toBe('سرور 🚀-002')
  })

  it('keeps a path carrying reserved characters intact without splitting the query', () => {
    const decoded = decodeQueryLink(link)
    expect(decoded.params.path).toBe('/ws?ed=2048')
    expect(decoded.params.ed).toBeUndefined()
  })

  it('reads a bare IP authority and defaults a missing port to 443', () => {
    expect(decodeQueryLink('vless://u@1.2.3.4:80?type=ws').address).toBe('1.2.3.4')
    expect(decodeQueryLink('vless://u@1.2.3.4?type=ws').port).toBe(443)
  })

  it('keeps the brackets on an IPv6 literal and still finds the port', () => {
    const decoded = decodeQueryLink('vless://u@[2606:4700::1111]:2053?type=ws')
    expect(decoded.address).toBe('[2606:4700::1111]')
    expect(decoded.port).toBe(2053)
  })

  it('leaves + alone in a value and keeps the last of a repeated key', () => {
    const decoded = decodeQueryLink('vless://u@1.2.3.4:443?path=%2Fa%2Bb&type=ws&type=grpc')
    expect(decoded.params.path).toBe('/a+b')
    expect(decoded.params.type).toBe('grpc')
  })

  it('reads a link with no fragment and no query', () => {
    const decoded = decodeQueryLink('vless://u@1.2.3.4:443')
    expect(decoded.remark).toBe('')
    expect(decoded.params).toEqual({})
  })

  it('throws when there is no credential segment', () => {
    expect(() => decodeQueryLink('vless://1.2.3.4:443?type=ws')).toThrow()
  })
})

describe('decodeSsLink', () => {
  // ADR-0005 / V18: the userinfo is opaque. Nothing decodes it, so nothing has
  // to tell base64 from percent-encoding, or SIP002 from SIP022.
  it('returns the credential segment byte-for-byte, colon included', () => {
    const decoded = decodeSsLink('ss://aes-256-gcm:p4ssw0rd@1.2.3.4:443?type=ws&host=x.example.com#ss-001')
    expect(decoded.credential).toBe('aes-256-gcm:p4ssw0rd')
    expect(decoded.address).toBe('1.2.3.4')
    expect(decoded.port).toBe(443)
    expect(decoded.remark).toBe('ss-001')
  })

  // The boundary is the FIRST `@`, matching how the credential is split off for
  // `ss` everywhere: neither base64 nor a percent-encoded segment can contain
  // one, so an `@` inside the credential is out of dialect, not a case to carry.
  it('splits the credential at the first @, not the last', () => {
    expect(decodeSsLink('ss://cred@1.2.3.4:443?type=ws').credential).toBe('cred')
  })

  it('does not decode a base64 credential, even one containing a slash', () => {
    const decoded = decodeSsLink('ss://YWVzLTI1Ni1nY206cC9zcw==@1.2.3.4:80?type=ws#ss-002')
    expect(decoded.credential).toBe('YWVzLTI1Ni1nY206cC9zcw==')
    expect(decoded.address).toBe('1.2.3.4')
  })
})

describe('decodeLink', () => {
  it('dispatches on the scheme and percent-decodes the remark for every scheme', () => {
    expect(decodeLink('vless://u@1.2.3.4:443?type=ws#a%20b-001').remark).toBe('a b-001')
    expect(decodeLink('trojan://pw@1.2.3.4:443?type=ws#a%20b-002').remark).toBe('a b-002')
    expect(decodeLink('ss://cred@1.2.3.4:443?type=ws#a%20b-003').remark).toBe('a b-003')
    expect(decodeLink(vmessLink({ ps: 'a b-004', add: '1.2.3.4', port: '443', id: 'u' })).remark).toBe('a b-004')
  })

  it('throws on an unrecognised scheme', () => {
    expect(() => decodeLink('hysteria://u@1.2.3.4:443')).toThrow()
    expect(() => decodeLink('not a link at all')).toThrow()
  })
})

describe('randomSniPattern', () => {
  it('matches the nonce shape genRandomSni writes, trailing dot included', () => {
    const re = randomSniPattern('x.example.com')
    expect('abcd1234.example.com.').toMatch(re)
    expect('abcdefghijkl.example.com.').toMatch(re)
    expect('abcd1234.example.com').not.toMatch(re)
  })

  it('takes the root domain only, so the subdomain prefix is stripped (V7)', () => {
    const re = randomSniPattern('a.b.example.com')
    expect('abcd1234.example.com.').toMatch(re)
    expect('abcd1234.b.example.com.').not.toMatch(re)
  })

  it('refuses a nonce outside 8-12 characters', () => {
    const re = randomSniPattern('example.com')
    expect('abcd123.example.com.').not.toMatch(re)
    expect('abcdefghijklm.example.com.').not.toMatch(re)
  })
})

describe('roundTripContext', () => {
  const minimal = {
    scheme: 'vless',
    credential: 'uuid',
    cdnAddress: '1.2.3.4',
    port: 443,
    routingSubdomain: 'x.example.com',
    transport: 'ws',
    label: 'name-001',
  }

  it('defaults everything the caller did not state', () => {
    const ctx = roundTripContext(minimal)
    expect(ctx.tls).toBe(false)
    expect(ctx.randomSni).toBe(false)
    expect(ctx.path).toBe('')
    expect(ctx.alpn).toBe('')
    expect(ctx.fp).toBe('')
    expect(ctx.sourceParams).toEqual({})
    expect(ctx.version).toBe('2')
    expect(ctx.alterId).toBe('0')
    expect(ctx.encryption).toBe('auto')
    expect(ctx.headerType).toBe('none')
  })

  // A missing fact would turn every assertion built on it into `undefined`
  // against `undefined`, which passes while proving nothing.
  it('refuses a context missing a required fact, or naming an unknown scheme', () => {
    for (const key of Object.keys(minimal)) {
      const partial = { ...minimal }
      delete partial[key]
      expect(() => roundTripContext(partial)).toThrow()
    }
    expect(() => roundTripContext({ ...minimal, scheme: 'hysteria' })).toThrow()
  })

  // An empty required fact is a missing one wearing a value: the builder drops
  // empty params, so an empty expectation would agree with a field that is
  // absent for exactly that reason.
  it('refuses an empty string as a required fact', () => {
    for (const key of Object.keys(minimal)) {
      if (typeof minimal[key] !== 'string') continue
      expect(() => roundTripContext({ ...minimal, [key]: '' })).toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// The map itself
// ---------------------------------------------------------------------------

const KINDS = [EXPECT.VALUE, EXPECT.PATTERN, EXPECT.ABSENT]

function contexts(scheme) {
  const base = {
    scheme,
    credential: 'cred',
    cdnAddress: '1.2.3.4',
    port: 443,
    routingSubdomain: 'a.example.com',
    transport: 'ws',
    label: 'name-001',
  }
  return [
    roundTripContext({ ...base, tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' }),
    roundTripContext({ ...base, tls: true, randomSni: true }),
    roundTripContext({ ...base, tls: false, port: 80 }),
  ]
}

describe('the intended-field map', () => {
  it('covers every supported scheme', () => {
    expect(Object.keys(INTENDED_FIELDS).sort()).toEqual([...SCHEMES].sort())
    expect(() => intendedFields('hysteria')).toThrow()
  })

  for (const scheme of SCHEMES) {
    describe(scheme, () => {
      it('every entry names a field, where it lives, and reads at least one path', () => {
        for (const entry of intendedFields(scheme)) {
          expect(typeof entry.field).toBe('string')
          expect(entry.field.length).toBeGreaterThan(0)
          expect(typeof entry.where).toBe('string')
          expect(entry.where.length).toBeGreaterThan(0)
          expect(entry.read.parsed || entry.read.decoded).toBeTruthy()
        }
      })

      // R4/KTD4: presence or absence, never silence. An entry that stated
      // neither would sit in the map looking like coverage it does not give.
      it('every entry states an expected value or an absence condition', () => {
        for (const ctx of contexts(scheme)) {
          for (const entry of intendedFields(scheme)) {
            const expectation = entry.expect(ctx)
            const paths = [expectation.parsed, expectation.decoded].filter(Boolean)
            expect(paths.length).toBeGreaterThan(0)
            for (const path of paths) {
              expect(KINDS).toContain(path.kind)
              if (path.kind === EXPECT.VALUE) expect(path.value).toBeDefined()
              if (path.kind === EXPECT.PATTERN) expect(path.pattern).toBeInstanceOf(RegExp)
            }
          }
        }
      })

      it('only reads a path it also states an expectation for', () => {
        for (const ctx of contexts(scheme)) {
          for (const entry of intendedFields(scheme)) {
            const expectation = entry.expect(ctx)
            if (expectation.parsed) expect(entry.read.parsed).toBeTypeOf('function')
            if (expectation.decoded) expect(entry.read.decoded).toBeTypeOf('function')
          }
        }
      })
    })
  }

  // KTD4's two readings: through the independent decoder the key is literally
  // absent; through `parseConfig` the vmess entries assert the normalised empty
  // value, because `parseVmess` materialises sni, alpn and fp on every result.
  it('a no-TLS link carries no sni, insecure, allowInsecure, alpn or fp', () => {
    const absentFields = ['server name', 'alpn', 'TLS fingerprint', 'certificate check (insecure)', 'certificate check (allowInsecure)']
    for (const scheme of SCHEMES) {
      const ctx = roundTripContext({
        scheme,
        credential: 'cred',
        cdnAddress: '1.2.3.4',
        port: 80,
        routingSubdomain: 'a.example.com',
        transport: 'ws',
        label: 'name-001',
        tls: false,
      })
      for (const entry of intendedFields(scheme).filter(e => absentFields.includes(e.field))) {
        const expectation = entry.expect(ctx)
        expect(expectation.decoded).toEqual({ kind: EXPECT.ABSENT })
        if (scheme === 'vmess' && entry.field !== 'certificate check (insecure)' && entry.field !== 'certificate check (allowInsecure)') {
          expect(expectation.parsed).toEqual({ kind: EXPECT.VALUE, value: '' })
        }
      }
    }
  })

  it('insecure and allowInsecure are asserted through the independent decoder only', () => {
    for (const scheme of SCHEMES) {
      for (const entry of intendedFields(scheme).filter(e => e.field.startsWith('certificate check'))) {
        expect(entry.read.parsed).toBeNull()
        expect(entry.expect(contexts(scheme)[0]).parsed).toBeNull()
      }
    }
  })

  it('expects the random SNI by pattern, since the nonce differs per run', () => {
    for (const scheme of SCHEMES) {
      const ctx = contexts(scheme)[1]
      const entry = intendedFields(scheme).find(e => e.field === 'server name')
      const expectation = entry.expect(ctx).decoded
      expect(expectation.kind).toBe(EXPECT.PATTERN)
      expect('abcd1234.example.com.').toMatch(expectation.pattern)
      expect('a.example.com').not.toMatch(expectation.pattern)
    }
  })
})

// ---------------------------------------------------------------------------
// The map against hand-built links
// ---------------------------------------------------------------------------

// The independent decode path only. The `parseConfig` path is the gate's (U4),
// which drives the real generator; here the point is that the map's expectations
// and the decoder agree on where every field lives and what shape it comes back
// in.
function checkDecoded(entry, ctx, decoded) {
  const expectation = entry.expect(ctx).decoded
  if (!expectation) return
  const actual = entry.read.decoded(decoded)
  if (expectation.kind === EXPECT.VALUE) expect(actual).toBe(expectation.value)
  else if (expectation.kind === EXPECT.PATTERN) expect(actual).toMatch(expectation.pattern)
  else expect(actual).toBeUndefined()
}

const ROUTING = 'a.example.com'

// Written exactly as `buildQueryLink` writes them: params in insertion order,
// empty values dropped, remark percent-encoded into the fragment.
function queryFixtures(scheme, credential) {
  const tail = `type=ws&host=${ROUTING}`
  return [
    {
      name: 'TLS, with alpn, fingerprint and a path carrying reserved characters',
      link: `${scheme}://${credential}@1.2.3.4:443?path=%2Fws%3Fed%3D2048&${tail}&security=tls&sni=${ROUTING}&insecure=0&allowInsecure=0&alpn=h2&fp=chrome#name-001`,
      ctx: roundTripContext({ scheme, credential, cdnAddress: '1.2.3.4', port: 443, routingSubdomain: ROUTING, transport: 'ws', label: 'name-001', tls: true, path: '/ws?ed=2048', alpn: 'h2', fp: 'chrome' }),
    },
    {
      name: 'no TLS, no optional params',
      link: `${scheme}://${credential}@1.2.3.4:80?${tail}&security=none#%D8%B3%D8%B1%D9%88%D8%B1%20%F0%9F%9A%80-002`,
      ctx: roundTripContext({ scheme, credential, cdnAddress: '1.2.3.4', port: 80, routingSubdomain: ROUTING, transport: 'ws', label: 'سرور 🚀-002' }),
    },
    {
      name: 'TLS with a random SNI nonce',
      link: `${scheme}://${credential}@1.2.3.4:443?${tail}&security=tls&sni=k3xq9mza.example.com.&insecure=0&allowInsecure=0#name-003`,
      ctx: roundTripContext({ scheme, credential, cdnAddress: '1.2.3.4', port: 443, routingSubdomain: ROUTING, transport: 'ws', label: 'name-003', tls: true, randomSni: true }),
    },
  ]
}

// Written exactly as `buildVmess` writes it: a fixed key set, plus sni and the
// selected TLS extras under TLS only.
const VMESS_FIXTURES = [
  {
    name: 'TLS, with alpn, fingerprint and a path carrying reserved characters',
    link: vmessLink({ v: '2', ps: 'name-001', add: '1.2.3.4', port: '443', id: 'uuid', aid: '0', scy: 'auto', net: 'ws', type: 'none', host: ROUTING, path: '/ws?ed=2048', tls: 'tls', sni: ROUTING, alpn: 'h2', fp: 'chrome' }),
    ctx: roundTripContext({ scheme: 'vmess', credential: 'uuid', cdnAddress: '1.2.3.4', port: 443, routingSubdomain: ROUTING, transport: 'ws', label: 'name-001', tls: true, path: '/ws?ed=2048', alpn: 'h2', fp: 'chrome' }),
  },
  {
    name: 'no TLS, no optional params',
    link: vmessLink({ v: '2', ps: 'سرور 🚀-002', add: '1.2.3.4', port: '80', id: 'uuid', aid: '0', scy: 'auto', net: 'ws', type: 'none', host: ROUTING, path: '', tls: 'none' }),
    ctx: roundTripContext({ scheme: 'vmess', credential: 'uuid', cdnAddress: '1.2.3.4', port: 80, routingSubdomain: ROUTING, transport: 'ws', label: 'سرور 🚀-002' }),
  },
  {
    name: 'TLS with a random SNI nonce',
    link: vmessLink({ v: '2', ps: 'name-003', add: '1.2.3.4', port: '443', id: 'uuid', aid: '0', scy: 'auto', net: 'ws', type: 'none', host: ROUTING, path: '', tls: 'tls', sni: 'k3xq9mza.example.com.' }),
    ctx: roundTripContext({ scheme: 'vmess', credential: 'uuid', cdnAddress: '1.2.3.4', port: 443, routingSubdomain: ROUTING, transport: 'ws', label: 'name-003', tls: true, randomSni: true }),
  },
]

const FIXTURES = {
  vless: queryFixtures('vless', 'uuid'),
  trojan: queryFixtures('trojan', 'password'),
  // The opaque segment, carried verbatim — colon and all (ADR-0005, V18).
  ss: queryFixtures('ss', 'aes-256-gcm:p4ssw0rd'),
  vmess: VMESS_FIXTURES,
}

for (const scheme of SCHEMES) {
  describe(`${scheme} map read against a hand-built link`, () => {
    for (const fixture of FIXTURES[scheme]) {
      describe(fixture.name, () => {
        for (const entry of intendedFields(scheme)) {
          it(`${entry.field} — ${entry.where}`, () => {
            checkDecoded(entry, fixture.ctx, decodeLink(fixture.link))
          })
        }
      })
    }
  })
}

// ---------------------------------------------------------------------------
// V19: the round-trip gate
// ---------------------------------------------------------------------------
//
// Everything above reads hand-built links. This is the loop the rest of the app
// never closed: a link the REAL generator emitted, read back and compared field
// by field against what the generator meant to write.
//
// The subject is the output of `generateLinks` — post-dedup, post-numbering —
// not the builder's interim output. `dedupeAndNumber` is the last writer of
// every link the app hands the user, so a builder that is right and a rewriter
// that is wrong still emits a broken link. That is exactly what happened.
//
// Both decode paths must agree: `parseConfig` satisfies the round trip through
// the project's own parser, `decodeLink` satisfies it through a decoder written
// independently of it, and neither alone can make the gate pass.

const CDN = '104.16.0.1'
const ROUTE = 'route.example.com'

const CREDENTIALS = {
  vless: 'uuid-1111',
  vmess: '11111111-2222-3333-4444-555555555555',
  trojan: 'p4ssw0rd',
  // Opaque and awkward on purpose: base64 padding and an inner `/`, neither of
  // which anything may decode or re-encode (ADR-0005, V18).
  ss: 'YWVzLTI1Ni1nY206cC9zcw==',
}

// The input table (R6): the ASCII happy path, plus the cases a fixed table has
// to buy deliberately because it cannot randomise its way into them. A trailing
// dot is not among them — `validateRoutingSubdomain` rejects it before
// generation, and the builder replaces the connect address anyway, so no
// emitted field can carry one.
// The reserved-character path carries `&`, not just `?`. A `?` inside a query
// value is not a delimiter, so both decode paths recover `/ws?ed=2048` whether
// or not the builder percent-encoded it — the row would stay green with the
// encoding removed. `&` is the character that actually discriminates: emitted
// raw, it splits the query and the path comes back truncated.
const GATE_ROWS = [
  { name: 'ASCII happy path', remark: 'my-config', address: 'origin.example.com', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' },
  { name: 'a Persian remark', remark: 'سرور تهران', address: 'origin.example.com', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' },
  { name: 'an emoji remark', remark: 'config 🚀', address: 'origin.example.com', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' },
  { name: 'an omitted optional parameter', remark: 'no-path', address: 'origin.example.com', tls: false },
  { name: 'a bare IP connect address', remark: 'bare-ip', address: '1.2.3.4', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' },
  { name: 'a path carrying reserved characters', remark: 'reserved-path', address: 'origin.example.com', tls: true, path: '/ws?ed=2048&leak=1', alpn: 'h2', fp: 'chrome' },
  { name: 'a random SNI nonce', remark: 'random-sni', address: 'origin.example.com', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome', randomSni: true },
  // ALPN and fingerprint are separate options the user selects separately, so
  // asserting them only together leaves either one free to go missing.
  { name: 'an ALPN with no fingerprint', remark: 'alpn-only', address: 'origin.example.com', tls: true, path: '/ws', alpn: 'h2' },
  { name: 'a fingerprint with no ALPN', remark: 'fp-only', address: 'origin.example.com', tls: true, path: '/ws', fp: 'chrome' },
  // Every other row is `ws`. The allowlist also admits xhttp, httpupgrade and
  // grpc, and the two builders diverge on them — buildQueryLink copies the
  // source params through while buildVmess writes a fixed key set.
  { name: 'a grpc transport', remark: 'grpc-cfg', address: 'origin.example.com', transport: 'grpc', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' },
]

// The source config the user pastes. `host` is always stated, so the bare-IP row
// still resolves a routing subdomain (V11) instead of being blocked by V10.
function sourceLink(scheme, row) {
  const transport = row.transport || 'ws'
  if (scheme === 'vmess') {
    const config = {
      v: '2', ps: row.remark, add: row.address, port: '443', id: CREDENTIALS.vmess,
      aid: '0', scy: 'auto', net: transport, type: 'none', host: ROUTE, tls: row.tls ? 'tls' : 'none',
    }
    // Omitted entirely rather than set empty, so the row exercises the parser's
    // default reaching the builder's fixed key set.
    if (row.path) config.path = row.path
    return vmessLink(config)
  }
  const query = [`type=${transport}`, `security=${row.tls ? 'tls' : 'none'}`, `host=${ROUTE}`]
  if (row.path) query.push(`path=${encodeURIComponent(row.path)}`)
  return `${scheme}://${CREDENTIALS[scheme]}@${row.address}:443?${query.join('&')}#${encodeURIComponent(row.remark)}`
}

function gateOptions(row) {
  return {
    enableTls: !!row.tls,
    enableNoTls: !row.tls,
    tlsPorts: [443],
    noTlsPorts: [80],
    alpn: row.alpn ? [row.alpn] : [],
    fingerprint: row.fp ? [row.fp] : [],
    randomSni: !!row.randomSni,
  }
}

function gateContext(scheme, row) {
  return roundTripContext({
    scheme,
    credential: CREDENTIALS[scheme],
    cdnAddress: CDN,
    port: row.tls ? 443 : 80,
    tls: !!row.tls,
    randomSni: !!row.randomSni,
    routingSubdomain: ROUTE,
    transport: row.transport || 'ws',
    path: row.path || '',
    alpn: row.alpn || '',
    fp: row.fp || '',
    // The remark dedup renumbers to, not the builder's interim suffix.
    label: `${row.remark}-001`,
  })
}

async function emit(scheme, row) {
  const { links } = await generateLinks(parseRows(sourceLink(scheme, row)), [CDN], gateOptions(row))
  return links
}

// One entry, both paths. A `null` expectation means that path does not speak to
// the field — skipped rather than guessed at, which is how `insecure` stays a
// decoder-only assertion even though `parseVmess` would happily return ''.
function assertEntry(entry, ctx, parsed, decoded) {
  const expectation = entry.expect(ctx)
  for (const path of ['parsed', 'decoded']) {
    const want = expectation[path]
    if (!want) continue
    const actual = entry.read[path](path === 'parsed' ? parsed : decoded)
    if (want.kind === EXPECT.VALUE) expect(actual).toBe(want.value)
    else if (want.kind === EXPECT.PATTERN) expect(String(actual)).toMatch(want.pattern)
    else expect(actual).toBeUndefined()
  }
}

for (const scheme of SCHEMES) {
  describe(`V19: ${scheme} links from generateLinks round-trip`, () => {
    for (const row of GATE_ROWS) {
      describe(row.name, () => {
        const ctx = gateContext(scheme, row)
        let emitted
        let parsed
        let decoded

        beforeAll(async () => {
          const links = await emit(scheme, row)
          expect(links).toHaveLength(1)
          emitted = links[0]
          parsed = parseConfig(emitted)
          decoded = decodeLink(emitted)
        })

        it('V19: parses back through the project parser without a null result', () => {
          expect(parsed).not.toBeNull()
          expect(parsed.type).toBe(scheme)
        })

        for (const entry of intendedFields(scheme)) {
          it(`V19: ${entry.field} comes back as written — ${entry.where}`, () => {
            assertEntry(entry, ctx, parsed, decoded)
          })
        }
      })
    }
  })
}

// The rows above assert the map entry by entry. These state the rules those
// entries exist to protect, in the terms the defect and the plan use.
describe('V19: what the gate is protecting', () => {
  it('V19: a reserved-character path does not split the query or leak a parameter', async () => {
    for (const scheme of SCHEMES) {
      const row = GATE_ROWS.find(r => r.name === 'a path carrying reserved characters')
      const [link] = await emit(scheme, row)
      expect(parseConfig(link).params.path).toBe('/ws?ed=2048&leak=1')
      expect(decodeLink(link).params.path).toBe('/ws?ed=2048&leak=1')
      // The `&` emitted raw would end the path here and start a parameter.
      // `leak` is a name neither builder writes and the vmess key whitelist
      // does not carry, so its presence can only mean the path split.
      expect(parseConfig(link).params.ed).toBeUndefined()
      expect(parseConfig(link).params.leak).toBeUndefined()
      expect(decodeLink(link).params.leak).toBeUndefined()
    }
  })

  // The product ships with both TLS modes enabled (SPEC C5), so the ordinary
  // run emits more than one link per config. Every row above pins one mode on
  // and asserts a single link, which leaves the multiplied case unread.
  it('V19: both TLS modes on emit two links from one config, and both round-trip', async () => {
    for (const scheme of SCHEMES) {
      const row = { name: 'both modes', remark: 'both-modes', address: 'origin.example.com', tls: true, path: '/ws', alpn: 'h2', fp: 'chrome' }
      const options = { ...gateOptions(row), enableNoTls: true }
      const { links } = await generateLinks(parseRows(sourceLink(scheme, row)), [CDN], options)
      expect(links).toHaveLength(2)

      // The multiplier writes the No-TLS port first, and numbering follows the
      // order the links were built in.
      const postures = [
        { link: links[0], ctx: gateContext(scheme, { ...row, tls: false, remark: 'both-modes' }) },
        { link: links[1], ctx: gateContext(scheme, { ...row, remark: 'both-modes' }) },
      ]
      postures[0].ctx = roundTripContext({ ...postures[0].ctx, label: 'both-modes-001' })
      postures[1].ctx = roundTripContext({ ...postures[1].ctx, label: 'both-modes-002' })

      for (const { link, ctx } of postures) {
        const parsed = parseConfig(link)
        expect(parsed).not.toBeNull()
        const decoded = decodeLink(link)
        for (const entry of intendedFields(scheme)) {
          assertEntry(entry, ctx, parsed, decoded)
        }
      }
    }
  })

  it('V19: a bare IP connect address still resolves the routing subdomain from host', async () => {
    for (const scheme of SCHEMES) {
      const [link] = await emit(scheme, GATE_ROWS.find(r => r.name === 'a bare IP connect address'))
      const parsed = parseConfig(link)
      expect(parsed.address).toBe(CDN)
      expect(parsed.routingSubdomain).toBe(ROUTE)
      expect(parsed.routingSubdomainRequired).toBe(false)
    }
  })

  // V3's rule, read off the emitted link rather than off the builder: no
  // handshake, so there is no server name to indicate and nothing to configure
  // about certificate checking.
  it('V19: a no-TLS link carries no sni, insecure, allowInsecure, alpn or fp', async () => {
    for (const scheme of SCHEMES) {
      const [link] = await emit(scheme, GATE_ROWS.find(r => r.name === 'an omitted optional parameter'))
      const params = decodeLink(link).params
      for (const key of ['sni', 'insecure', 'allowInsecure', 'alpn', 'fp']) {
        expect(params[key]).toBeUndefined()
      }
      // Through the parser the vmess row reads the normalised empty value
      // instead, because parseVmess materialises these keys on every result.
      const parsedParams = parseConfig(link).params
      const absentValue = scheme === 'vmess' ? '' : undefined
      expect(parsedParams.sni).toBe(absentValue)
      expect(parsedParams.alpn).toBe(absentValue)
      expect(parsedParams.fp).toBe(absentValue)
    }
  })

  it('V19: under random SNI the server name is a nonce rooted in the routing subdomain', async () => {
    for (const scheme of SCHEMES) {
      const [link] = await emit(scheme, GATE_ROWS.find(r => r.name === 'a random SNI nonce'))
      const sni = decodeLink(link).params.sni
      expect(sni).toMatch(randomSniPattern(ROUTE))
      expect(sni.endsWith('.example.com.')).toBe(true)
      expect(sni).not.toBe(ROUTE)
    }
  })

  // The remark the gate asserts is the one numbering writes last, which is also
  // why two configs sharing a base remark cannot come back with the same label.
  it('V19: two configs sharing a base remark come back with distinct labels', async () => {
    for (const scheme of SCHEMES) {
      // The two configs must differ somewhere identity-bearing, or dedup is
      // right to collapse them: the builder rewrites the connect address, so
      // two configs differing only there emit the same link (V1).
      const base = { name: 'shared', remark: 'shared-remark', address: 'origin.example.com', tls: true, alpn: 'h2', fp: 'chrome' }
      const raw = [
        sourceLink(scheme, { ...base, path: '/ws' }),
        sourceLink(scheme, { ...base, path: '/ws2' }),
      ].join('\n')
      const { links } = await generateLinks(parseRows(raw), [CDN], gateOptions(base))
      expect(links).toHaveLength(2)
      const labels = links.map(link => decodeLink(link).remark)
      expect(labels).toEqual(['shared-remark-001', 'shared-remark-002'])
      expect(links.map(link => parseConfig(link).remark)).toEqual(labels)
    }
  })
})
