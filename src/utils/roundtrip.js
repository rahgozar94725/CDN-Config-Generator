// The round-trip contract: what the generator INTENDS every emitted link to say,
// and a second, independent way of reading a link back.
//
// Nothing in this app has ever read back what it writes, which is how a `vmess`
// payload encoding that no client can open survived from the initial commit. The
// gate that closes that loop needs two things this module supplies, and neither
// belongs in a test file: a per-scheme statement of the fields the generator
// means to write, and a decoder that does not share a failure with the one under
// test.
//
// **The map is a specification, not a fixture.** Field names and value semantics
// come from each scheme's client-facing grammar — XTLS/Xray-core issue #91 for
// the query schemes, the v2rayN `VMessQRCodeFormat` object for `vmess`, ADR-0005
// for the `ss` credential — not from `src/utils/multiplier.js`. Reading the map
// off the builder would only assert that the builder equals itself.
//
// **The guarantee is field preservation, not string identity.** A generated link
// cannot equal its source: the builder deliberately rewrites address, port, TLS
// state and remark. What must survive is every mapped field's value.
//
// **The map pins the builder's CURRENT intent, not a judgement of it.** Whether
// the emitted field set is the RIGHT one — `host` on gRPC, `insecure` under TLS,
// the `vmess` parser's fixed key whitelist — is a separate transport-shape
// question. Where the two differ, the difference is a comment here, never a
// failing entry. Those notes are collected at the bottom of this file.
//
// **Membership is what the builder writes today.** A grammar field the builder
// never writes has no entry, because an entry asserting the absence of something
// nobody proposed to write states nothing. The exceptions are `insecure` and
// `allowInsecure`, which do appear as absence entries: the builder writes them
// under TLS for the query schemes, so their disappearance under no-TLS is a real
// rule (V3's reasoning — no handshake, nothing to configure about it).
//
// **The decoder imports nothing from `src/utils/parser.js`.** That is the whole
// point of the second path: a parser that mirrors a builder mistake — as
// `decodeBase64` mirrored the percent-encoded payload — must not be able to make
// the gate pass. Nothing from `src/utils/multiplier.js` is imported either; the
// builder is the subject under test, so borrowing its helpers (root-domain
// extraction, for one) would re-close the same loop from the other side.
//
// **The decoder normalises to the shapes `parseConfig` produces** — port as a
// number, authority host lowercased, fragment percent-decoded — so a single map
// entry can be compared against both decode paths instead of needing two sets of
// expectations. It stops short of `parseConfig`'s defaulting: a key the payload
// does not carry reads `undefined`, never `''`, because absence has to stay
// visible on this path (see the two readings of absence below).

// ---------------------------------------------------------------------------
// Expectations
// ---------------------------------------------------------------------------

// Every entry resolves, per decode path, to one of three descriptors. A path
// whose descriptor is `null` does not speak to that field at all.
//
//   { kind: 'value',   value }    strict equality
//   { kind: 'pattern', pattern }  RegExp match — the random-SNI nonce, which is
//                                 generated per run and cannot be pinned
//   { kind: 'absent' }            the field is not there
//
// Absence has two readings because the two paths normalise differently. Through
// the independent decoder the key must be LITERALLY ABSENT from the payload.
// Through `parseConfig` the `vmess` entries assert the parser's normalised EMPTY
// value instead, because `parseVmess` materialises `sni`, `alpn` and `fp` on
// every result whether the payload carried them or not.
export const EXPECT = Object.freeze({ VALUE: 'value', PATTERN: 'pattern', ABSENT: 'absent' })

export const SCHEMES = Object.freeze(['vless', 'vmess', 'trojan', 'ss'])

function value(v) {
  return { kind: EXPECT.VALUE, value: v }
}

function pattern(re) {
  return { kind: EXPECT.PATTERN, pattern: re }
}

const ABSENT = Object.freeze({ kind: EXPECT.ABSENT })

// Both paths assert the same thing — the ordinary case.
function both(descriptor) {
  return { parsed: descriptor, decoded: descriptor }
}

// Only the independent decoder speaks. `insecure` and `allowInsecure` are read
// this way for all four schemes: the `vmess` key whitelist never surfaces them,
// so pinning the assertion to the decoder gives one rule that holds everywhere
// rather than a query-scheme rule with a `vmess` hole in it.
function decodedOnly(descriptor) {
  return { parsed: null, decoded: descriptor }
}

// ---------------------------------------------------------------------------
// The generation-input context
// ---------------------------------------------------------------------------

// The facts about one generation run that every expectation derives from. It is
// stated by the caller rather than read back off the link, for the same reason
// `dedupeAndNumber` takes the base remark as an argument: a value recovered from
// the output cannot testify about the input that produced it.
//
// `label` is the renumbered `<base>-NNN` that `withRemark` stamps last, not the
// builder's interim suffix — dedup is the final writer of every emitted link.
//
// `alpn` and `fp` are the SELECTED values ('' when the user selected none). The
// query schemes copy the source config's own params through, so their entries
// also consult `sourceParams`; `buildVmess` builds a fresh object, so the `vmess`
// entries consult the selection only. That divergence is one of the reasons the
// map is per scheme.
const REQUIRED_CONTEXT = ['scheme', 'credential', 'cdnAddress', 'port', 'routingSubdomain', 'transport', 'label']

export function roundTripContext(input) {
  const source = input || {}
  for (const key of REQUIRED_CONTEXT) {
    // A missing fact would silently turn an assertion into `undefined` against
    // `undefined`, which passes while proving nothing. The empty string is
    // refused for the same reason: the builder drops empty query params, so an
    // empty expectation would be compared against a field that is absent for
    // that very reason and agree with itself.
    if (source[key] === undefined || source[key] === null || source[key] === '') {
      throw new Error(`roundtrip: context is missing ${key}`)
    }
  }
  if (!SCHEMES.includes(source.scheme)) {
    throw new Error(`roundtrip: unknown scheme ${source.scheme}`)
  }
  return Object.freeze({
    scheme: source.scheme,
    // The source link's userinfo, verbatim. For `ss` this is the opaque segment
    // ADR-0005 and V18 carry byte-for-byte, never a decoded `method:password`.
    credential: source.credential,
    cdnAddress: source.cdnAddress,
    port: source.port,
    tls: !!source.tls,
    randomSni: !!source.randomSni,
    routingSubdomain: source.routingSubdomain,
    transport: source.transport,
    path: source.path || '',
    alpn: source.alpn || '',
    fp: source.fp || '',
    sourceParams: source.sourceParams || {},
    label: source.label,
    // vmess-only, carried from the source config with the builder's defaults.
    version: source.version || '2',
    alterId: source.alterId || '0',
    encryption: source.encryption || 'auto',
    headerType: source.headerType || 'none',
  })
}

// `genRandomSni` writes `<8-12 lowercase alnum>.<root domain>.` — a nonce, so the
// expectation is a shape, not a value. The trailing dot is part of it: it is the
// absolute-name form, and V15 allows it in `sni` and nowhere else. The root is
// the last two labels of the routing subdomain (V7), re-derived here rather than
// imported from the builder that writes it.
export function randomSniPattern(routingSubdomain) {
  return new RegExp(`^[a-z0-9]{8,12}\\.${escapeRegExp(rootDomain(routingSubdomain))}\\.$`)
}

function rootDomain(host) {
  const parts = String(host).replace(/\.+$/, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  return parts.slice(-2).join('.')
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function serverName(ctx) {
  // No TLS handshake, so there is no server name to indicate (V3).
  if (!ctx.tls) return null
  if (ctx.randomSni) return pattern(randomSniPattern(ctx.routingSubdomain))
  return value(ctx.routingSubdomain)
}

// The TLS extras are written only when the user selected them, so "absent" here
// is the ordinary case rather than an error condition.
function selected(ctx, name) {
  if (!ctx.tls) return ''
  return ctx[name] || ctx.sourceParams[name] || ''
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

// One entry per grammar field: what it is called, where it lives in the link,
// how each decode path reads it, when it must be absent, and — given the
// generation context — what each path must find there.
//
//   field       the grammar's name for it
//   where       where it lives in this scheme's link
//   absentWhen  prose statement of the absence condition, or null
//   read        { parsed, decoded } readers; `null` where a path cannot see it
//   expect      ctx => { parsed, decoded } expectation descriptors
function queryFields(credentialNote) {
  return [
    {
      field: 'connect address',
      where: 'authority host',
      absentWhen: null,
      read: { parsed: p => p.address, decoded: d => d.address },
      // Both paths lowercase the authority the way a URL host is lowercased, so
      // the expectation is lowercased too rather than the CDN entry as typed.
      expect: ctx => both(value(String(ctx.cdnAddress).toLowerCase())),
    },
    {
      field: 'connect port',
      where: 'authority port',
      absentWhen: null,
      read: { parsed: p => p.port, decoded: d => d.port },
      expect: ctx => both(value(ctx.port)),
    },
    {
      field: 'credential',
      where: `userinfo — ${credentialNote}`,
      absentWhen: null,
      read: { parsed: p => p.uuid, decoded: d => d.credential },
      expect: ctx => both(value(ctx.credential)),
    },
    {
      field: 'transport',
      where: '`type` query parameter',
      absentWhen: null,
      read: { parsed: p => p.transport, decoded: d => d.params.type },
      expect: ctx => both(value(ctx.transport)),
    },
    {
      field: 'routing subdomain',
      where: '`host` query parameter — the Host header the CDN routes on',
      absentWhen: null,
      read: { parsed: p => p.params.host, decoded: d => d.params.host },
      expect: ctx => both(value(ctx.routingSubdomain)),
    },
    {
      field: 'transport path',
      where: '`path` query parameter',
      absentWhen: 'the source config carries no path — the builder drops empty params',
      read: { parsed: p => p.params.path, decoded: d => d.params.path },
      expect: ctx => both(ctx.path ? value(ctx.path) : ABSENT),
    },
    {
      field: 'TLS posture',
      where: '`security` query parameter',
      absentWhen: null,
      read: { parsed: p => p.security, decoded: d => d.params.security },
      expect: ctx => both(value(ctx.tls ? 'tls' : 'none')),
    },
    {
      field: 'server name',
      where: '`sni` query parameter',
      absentWhen: 'no TLS',
      read: { parsed: p => p.params.sni, decoded: d => d.params.sni },
      expect: ctx => both(serverName(ctx) || ABSENT),
    },
    {
      field: 'alpn',
      where: '`alpn` query parameter',
      absentWhen: 'no TLS, or no ALPN selected and the source config carried none',
      read: { parsed: p => p.params.alpn, decoded: d => d.params.alpn },
      expect: ctx => both(selected(ctx, 'alpn') ? value(selected(ctx, 'alpn')) : ABSENT),
    },
    {
      field: 'TLS fingerprint',
      where: '`fp` query parameter',
      absentWhen: 'no TLS, or no fingerprint selected and the source config carried none',
      read: { parsed: p => p.params.fp, decoded: d => d.params.fp },
      expect: ctx => both(selected(ctx, 'fp') ? value(selected(ctx, 'fp')) : ABSENT),
    },
    {
      field: 'certificate check (insecure)',
      where: '`insecure` query parameter',
      absentWhen: 'no TLS',
      read: { parsed: null, decoded: d => d.params.insecure },
      expect: ctx => decodedOnly(ctx.tls ? value('0') : ABSENT),
    },
    {
      field: 'certificate check (allowInsecure)',
      where: '`allowInsecure` query parameter',
      absentWhen: 'no TLS',
      read: { parsed: null, decoded: d => d.params.allowInsecure },
      expect: ctx => decodedOnly(ctx.tls ? value('0') : ABSENT),
    },
    {
      field: 'remark',
      where: 'fragment, percent-encoded',
      absentWhen: null,
      // The renumbered label dedup stamps last, not the builder's interim suffix.
      read: { parsed: p => p.remark, decoded: d => d.remark },
      expect: ctx => both(value(ctx.label)),
    },
  ]
}

// vmess states the same facts inside a base64 JSON object under its own key
// names, which is why the map is per scheme rather than shared. Two traps live
// here: `type` means the header obfuscation, not the transport (`net` carries
// that), and `buildVmess` writes a FIXED key set, so an omitted optional comes
// back as `''` rather than missing.
const VMESS_FIELDS = [
  {
    field: 'connect address',
    where: '`add` in the base64 JSON payload',
    absentWhen: null,
    // No lowercasing on either path: this is a JSON string field, not a URL host.
    read: { parsed: p => p.address, decoded: d => d.address },
    expect: ctx => both(value(ctx.cdnAddress)),
  },
  {
    field: 'connect port',
    where: '`port` in the base64 JSON payload',
    absentWhen: null,
    // Written as a string, read as a number by both paths.
    read: { parsed: p => p.port, decoded: d => d.port },
    expect: ctx => both(value(ctx.port)),
  },
  {
    field: 'credential',
    where: '`id` in the base64 JSON payload — the user UUID',
    absentWhen: null,
    read: { parsed: p => p.uuid, decoded: d => d.params.id },
    expect: ctx => both(value(ctx.credential)),
  },
  {
    field: 'transport',
    where: '`net` in the base64 JSON payload',
    absentWhen: null,
    read: { parsed: p => p.transport, decoded: d => d.params.net },
    expect: ctx => both(value(ctx.transport)),
  },
  {
    field: 'routing subdomain',
    where: '`host` in the base64 JSON payload — the Host header the CDN routes on',
    absentWhen: null,
    read: { parsed: p => p.params.host, decoded: d => d.params.host },
    expect: ctx => both(value(ctx.routingSubdomain)),
  },
  {
    field: 'transport path',
    where: '`path` in the base64 JSON payload',
    absentWhen: 'never — the fixed key set writes an empty string instead',
    read: { parsed: p => p.params.path, decoded: d => d.params.path },
    expect: ctx => both(value(ctx.path)),
  },
  {
    field: 'TLS posture',
    where: '`tls` in the base64 JSON payload',
    absentWhen: null,
    // `parseVmess` normalises the raw value to `security`; the two agree because
    // the builder only ever writes `tls` or `none`.
    read: { parsed: p => p.security, decoded: d => d.params.tls },
    expect: ctx => both(value(ctx.tls ? 'tls' : 'none')),
  },
  {
    field: 'server name',
    where: '`sni` in the base64 JSON payload',
    absentWhen: 'no TLS — literally absent from the payload, but `parseVmess` materialises it as an empty string',
    read: { parsed: p => p.params.sni, decoded: d => d.params.sni },
    expect: ctx => {
      const expected = serverName(ctx)
      if (expected) return both(expected)
      return { parsed: value(''), decoded: ABSENT }
    },
  },
  {
    field: 'alpn',
    where: '`alpn` in the base64 JSON payload',
    absentWhen: 'no TLS or no ALPN selected — `parseVmess` materialises it as an empty string',
    read: { parsed: p => p.params.alpn, decoded: d => d.params.alpn },
    expect: ctx => (ctx.tls && ctx.alpn
      ? both(value(ctx.alpn))
      : { parsed: value(''), decoded: ABSENT }),
  },
  {
    field: 'TLS fingerprint',
    where: '`fp` in the base64 JSON payload',
    absentWhen: 'no TLS or no fingerprint selected — `parseVmess` materialises it as an empty string',
    read: { parsed: p => p.params.fp, decoded: d => d.params.fp },
    expect: ctx => (ctx.tls && ctx.fp
      ? both(value(ctx.fp))
      : { parsed: value(''), decoded: ABSENT }),
  },
  {
    field: 'certificate check (insecure)',
    where: '`insecure` in the base64 JSON payload',
    absentWhen: 'always — `buildVmess` never writes it, under TLS or otherwise',
    read: { parsed: null, decoded: d => d.params.insecure },
    expect: () => decodedOnly(ABSENT),
  },
  {
    field: 'certificate check (allowInsecure)',
    where: '`allowInsecure` in the base64 JSON payload',
    absentWhen: 'always — `buildVmess` never writes it, under TLS or otherwise',
    read: { parsed: null, decoded: d => d.params.allowInsecure },
    expect: () => decodedOnly(ABSENT),
  },
  {
    field: 'remark',
    where: '`ps` in the base64 JSON payload',
    absentWhen: null,
    read: { parsed: p => p.remark, decoded: d => d.remark },
    expect: ctx => both(value(ctx.label)),
  },
  {
    field: 'format version',
    where: '`v` in the base64 JSON payload',
    absentWhen: null,
    read: { parsed: p => p.params.v, decoded: d => d.params.v },
    expect: ctx => both(value(ctx.version)),
  },
  {
    field: 'alterId',
    where: '`aid` in the base64 JSON payload',
    absentWhen: null,
    read: { parsed: p => p.params.aid, decoded: d => d.params.aid },
    expect: ctx => both(value(ctx.alterId)),
  },
  {
    field: 'encryption',
    where: '`scy` in the base64 JSON payload — the VMess cipher, not VLESS `encryption`',
    absentWhen: null,
    read: { parsed: p => p.params.scy, decoded: d => d.params.scy },
    expect: ctx => both(value(ctx.encryption)),
  },
  {
    field: 'header obfuscation',
    where: '`type` in the base64 JSON payload — NOT the transport; `net` carries that',
    absentWhen: null,
    // `parseVmess` renames it to `headerType` so it stops colliding with the
    // query schemes' `type`, which is the transport.
    read: { parsed: p => p.params.headerType, decoded: d => d.params.type },
    expect: ctx => both(value(ctx.headerType)),
  },
]

export const INTENDED_FIELDS = Object.freeze({
  vless: queryFields('the user UUID'),
  trojan: queryFields('the password'),
  // ADR-0005 / V18: opaque. The segment arrives from the source link and is
  // carried byte-for-byte — never base64-decoded, never re-encoded, never split
  // into the grammar's `method:password`. Asserting the decomposition would
  // assert a behaviour the generator deliberately does not have.
  ss: queryFields('the opaque credential segment, verbatim (ADR-0005, V18)'),
  vmess: VMESS_FIELDS,
})

export function intendedFields(scheme) {
  const entries = INTENDED_FIELDS[scheme]
  if (!entries) throw new Error(`roundtrip: no intended-field map for scheme ${scheme}`)
  return entries
}

// ---------------------------------------------------------------------------
// The independent decoders
// ---------------------------------------------------------------------------

// Written from the grammar with platform primitives only. They THROW on anything
// they cannot read rather than returning null: a decoder that fails quietly is
// the exact shape of the defect this module exists to catch — the gate would go
// green on a link nothing can open.

export function decodeLink(link) {
  const scheme = String(link).slice(0, String(link).indexOf('://'))
  switch (scheme) {
    case 'vless':
    case 'trojan':
      return decodeQueryLink(link)
    case 'ss':
      return decodeSsLink(link)
    case 'vmess':
      return decodeVmessLink(link)
    default:
      throw new Error(`roundtrip: unrecognised scheme in ${link}`)
  }
}

// vless and trojan. The userinfo/authority boundary is the LAST `@`, which is
// what a URL parser uses.
export function decodeQueryLink(link) {
  return decodeAuthorityLink(link, credential => credential.lastIndexOf('@'))
}

// ss carries the same shape, but the boundary is the FIRST `@`: the credential
// is opaque, so it is taken as bytes and never interpreted (ADR-0005, V18).
export function decodeSsLink(link) {
  return decodeAuthorityLink(link, credential => credential.indexOf('@'))
}

function decodeAuthorityLink(link, findAt) {
  const text = String(link)
  const sep = text.indexOf('://')
  if (sep === -1) throw new Error(`roundtrip: no scheme in ${text}`)
  const scheme = text.slice(0, sep)

  const { head, remark } = splitFragment(text.slice(sep + 3))
  // `?` cannot appear unescaped in userinfo or in a host, so splitting the query
  // off first is safe. A `/` can appear inside an opaque `ss` credential, so the
  // path is only stripped after the credential has been taken off.
  const q = head.indexOf('?')
  const beforeQuery = q === -1 ? head : head.slice(0, q)
  const query = q === -1 ? '' : head.slice(q + 1)

  const at = findAt(beforeQuery)
  if (at <= 0) throw new Error(`roundtrip: ${scheme} link has no credential segment`)
  const credential = beforeQuery.slice(0, at)
  const { host, port } = splitHostPort(stripPath(beforeQuery.slice(at + 1)))

  return { scheme, credential, address: host, port, params: parseQuery(query), remark }
}

function splitFragment(rest) {
  const hash = rest.indexOf('#')
  if (hash === -1) return { head: rest, remark: '' }
  return { head: rest.slice(0, hash), remark: decodeURIComponent(rest.slice(hash + 1)) }
}

function stripPath(authority) {
  const slash = authority.indexOf('/')
  return slash === -1 ? authority : authority.slice(0, slash)
}

// Lowercased and defaulted to 443 to match the shapes `parseConfig` produces.
// An IPv6 literal keeps its brackets, the way a URL host does; it is not
// otherwise canonicalised, so a non-minimal IPv6 form would read differently
// here than through a URL parser. No CDN entry the app accepts has that shape.
function splitHostPort(authority) {
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']')
    if (close === -1) throw new Error(`roundtrip: unterminated IPv6 host in ${authority}`)
    const rest = authority.slice(close + 1)
    return {
      host: authority.slice(0, close + 1).toLowerCase(),
      port: Number(rest.startsWith(':') ? rest.slice(1) : '') || 443,
    }
  }
  const colon = authority.lastIndexOf(':')
  if (colon === -1) return { host: authority.toLowerCase(), port: 443 }
  return { host: authority.slice(0, colon).toLowerCase(), port: Number(authority.slice(colon + 1)) || 443 }
}

// Split on `&`, then on the FIRST `=`, then percent-decode each half. `+` is left
// alone: it is a literal in a URI query, and the `+`-means-space rule belongs to
// HTML form encoding, not here. A repeated key keeps its last value, which is
// what collecting the pairs into an object gives on the other path too.
function parseQuery(query) {
  const params = {}
  for (const pair of query.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq))
    params[key] = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1))
  }
  return params
}

// vmess: base64 of UTF-8 JSON bytes. A client base64-decodes and parses JSON with
// no step in between, and so does this — which is exactly why a payload in the
// old shape, base64 of a percent-encoded JSON string, throws here instead of
// decoding: the bytes come back as `%7B%22v%22...`, and `JSON.parse` refuses
// them. That refusal is the point, not a gap to be patched with a fallback.
export function decodeVmessLink(link) {
  const text = String(link)
  if (!text.startsWith('vmess://')) throw new Error(`roundtrip: not a vmess link: ${text}`)
  const payload = jsonFromBase64(text.slice('vmess://'.length))
  const config = JSON.parse(payload)
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('roundtrip: vmess payload is not a JSON object')
  }
  return {
    scheme: 'vmess',
    // Top-level fields mirror the query schemes so one map entry can read either
    // shape. They are NOT defaulted — a missing key must stay visibly missing.
    credential: config.id,
    address: config.add,
    // Normalised to a number to match parseConfig's shape, but deliberately not
    // defaulted the way parseVmess defaults it: a decoder that manufactures 443
    // for a payload carrying no port agrees with the parser about a value
    // neither of them read, which is the shared blind spot this path exists to
    // avoid. A missing port reads undefined here and fails its map entry.
    port: config.port === undefined ? undefined : Number(config.port),
    // The decoded object itself, so an entry reads a payload key literally and
    // an absent key reads `undefined`.
    params: config,
    remark: config.ps,
  }
}

// base64url and missing padding are accepted on the read side — a pasted link may
// carry either — but nothing here decodes twice.
function jsonFromBase64(payload) {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  // `fatal` so mis-encoded bytes throw instead of arriving as replacement
  // characters, which would corrupt a non-ASCII remark silently.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

// ---------------------------------------------------------------------------
// Transport-shape notes — questions, not gate failures
// ---------------------------------------------------------------------------
//
// These are places where the grammar and the builder disagree. The map pins the
// builder's current intent either way; whether the intent is right belongs to the
// transport-shape work, and recording the questions here is how the two efforts
// stay out of each other's way.
//
// - `serviceName` (gRPC) and `mode` (gRPC) are grammar fields the builder never
//   writes. A gRPC config that carried them as source params survives for the
//   query schemes — `buildQueryLink` copies the source params through — but is
//   dropped for `vmess`, which builds a fixed key set. Neither is mapped.
// - `seed` (mKCP) is in the same position. mKCP is not an allowed transport
//   here (`rows.js`), so it can only arrive as a stray param.
// - `insecure` and `allowInsecure` are written under TLS for the query schemes,
//   and XTLS/Xray-core issue #91 deliberately omits both — it holds that an
//   insecure node is unsuitable for sharing. The map records what is written.
// - `fp` is not in issue #91's table either; it is the later uTLS fingerprint
//   field, and the ecosystem carries it in both the query string and the vmess
//   object. Mapped because the builder writes it.
// - `host` is written for every transport, including gRPC, where the grammar
//   scopes it to HTTP/2 and WebSocket.
// - `parseVmess` reads a fixed key whitelist, so any vmess payload key outside
//   it is dropped on the parse path even when the payload carries it. The
//   independent decoder keeps every key, which is why the two paths need
//   separate absence readings.
// - issue #91 describes a URI form for VMess (`vmess://uuid@host:port?...`).
//   This app emits the older v2rayN base64-JSON object instead, which is what
//   the ecosystem's clients actually read, so the `vmess` map takes its key
//   names from that format.
