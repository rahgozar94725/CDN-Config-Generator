import { decodeBase64, encodeBase64 } from './parser.js'

// The engine for the whole dedup + per-remark numbering ticket chain: given the
// built origin links together with their base remark (the "routing context"
// ticket #10 refers to), it collapses links with equal normalised identity
// (first-wins) and then numbers the survivors per remark text across the whole
// run (ADR-0006). It is a pure function — it does not know about rows, options
// or the pipeline; generation.js hosts it as the last step of generateLinks.
//
// The remark is passed in rather than guessed from the link: a fragment/`ps`
// ending in `-001` cannot be told apart from a genuine remark that ends in three
// digits, so deriving the base remark from the link would silently corrupt a
// label like `server-123`. Numbering is therefore keyed on the explicit remark.
//
// Dedup must run before numbering: a link's identity deliberately excludes the
// remark, so two links that differ only in label collapse to one (V1), and only
// what survives gets a number, so survivors within a label read `001-N` with no
// holes (V4).
//
// Under random SNI the generated `sni` is a nonce, regenerated per built link, so
// leaving it in identity means no two links ever match and dedup is off exactly
// for the users who have the option on. The caller states that the SNI is random
// — it is not guessed from the link — and identity then ignores `sni`. Nothing is
// lost: `host` carries the routing subdomain unrandomised, so links that differ
// in where they route still differ in identity.

export function isVmess(link) {
  return link.startsWith('vmess://')
}

function splitFragment(link) {
  const hash = link.indexOf('#')
  if (hash === -1) return { head: link, fragment: '' }
  return { head: link.slice(0, hash), fragment: link.slice(hash + 1) }
}

// vless, trojan and ss state their identity in the URL: scheme, credentials,
// address, port and every query parameter (which carries transport, security,
// host, sni and so on). The remark lives in the fragment, so identity is the
// whole link minus the fragment, with the query compared order-insensitively so
// a reordered `key=value` pair is the same link, not a different one. The link
// keeps its original byte order; only the identity is canonicalised.
function queryLinkIdentity(link, randomSni) {
  const { head } = splitFragment(link)
  const q = head.indexOf('?')
  if (q === -1) return head
  let pairs = head.slice(q + 1).split('&').filter(Boolean)
  if (randomSni) pairs = pairs.filter(pair => !pair.startsWith('sni='))
  return `${head.slice(0, q)}?${pairs.sort().join('&')}`
}

// vmess is base64 of UTF-8 JSON bytes, and nothing else. This site used to also
// accept base64 of percent-encoded JSON, because that is what our own generator
// wrote — a shape no standard client can read, so no link in it has ever worked
// and there is nothing to stay compatible with (ADR-0007). Refusing it here is
// the read-side half of that clean break: an old-shape link states no identity
// and keeps its own label, rather than being quietly absorbed and re-emitted.
// Throws when the payload does not decode; every caller decides what that means.
function vmessConfig(link) {
  return JSON.parse(decodeBase64(link.replace('vmess://', '')))
}

// vmess states its identity inside a base64 JSON object rather than the URL, and
// its remark is the `ps` field, so identity is the decoded config with `ps`
// dropped. Keys are sorted for a canonical string so field order does not matter
// either. This being a string that only ever meets other vmess keys (a vmess
// link cannot equal a vless one), cross-scheme collisions are impossible.
//
// A link that does not decode states no identity at all: it falls back to its own
// bytes, so it can only equal a byte-identical twin. Returning one shared value
// instead would collapse every unreadable link into a single survivor.
function vmessIdentity(link, randomSni) {
  let obj
  try {
    obj = vmessConfig(link)
  } catch {
    return link
  }
  delete obj.ps
  if (randomSni) delete obj.sni
  const sorted = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key]
    return acc
  }, {})
  return JSON.stringify(sorted)
}

export function linkIdentity(link, options) {
  const randomSni = !!(options && options.randomSni)
  if (isVmess(link)) return `vmess:${vmessIdentity(link, randomSni)}`
  return queryLinkIdentity(link, randomSni)
}

// Rewrites a numbered remark back into a link. vless/trojan/ss carry it as a
// percent-encoded fragment; vmess as the `ps` field of its base64 JSON object,
// re-encoded with the same codec the multiplier builds with so it still parses
// back. This is the last writer of every vmess link the app emits, so an
// encoding the multiplier gets right and this site gets wrong is still wrong in
// the output the user is handed.
//
// A link that does not decode keeps the label it arrived with, the same posture
// vmessIdentity takes on the identity side: numbering runs over the whole run at
// once, so throwing on one unreadable link would cost every other link's output.
// Nothing built by the generator reaches here undecodable — the guard exists
// because dedupeAndNumber is exported and called directly.
function withRemark(link, remark) {
  if (isVmess(link)) {
    let obj
    try {
      obj = vmessConfig(link)
    } catch {
      return link
    }
    obj.ps = remark
    return 'vmess://' + encodeBase64(JSON.stringify(obj))
  }
  return `${splitFragment(link).head}#${encodeURIComponent(remark)}`
}

// Entries are `{ link, remark }` pairs: the built origin link plus its base
// remark (the routing context). The engine deduplicates first-wins on link
// identity, then numbers the survivors per remark text across the whole run.
// `options.randomSni` states that the generated SNI is a nonce, so identity
// ignores it.
export function dedupeAndNumber(entries, options) {
  const seen = new Set()
  const survivors = []
  // Which entry each survivor came from, so a caller that knows where its entries
  // belong in the output (generation.js keeps passthrough lines in row order) can
  // place the survivors back without re-deriving identity.
  const kept = []
  entries.forEach((entry, index) => {
    const id = linkIdentity(entry.link, options)
    if (seen.has(id)) return
    seen.add(id)
    survivors.push(entry)
    kept.push(index)
  })

  const dropped = entries.length - survivors.length
  // Keyed on the label base, not the remark text: the label of a config with no
  // remark is `config-NNN`, so a config whose remark *is* `config` must share that
  // sequence or both write `config-001`. A Map, so a remark naming a prototype
  // member (`constructor`, `toString`) counts from 0 like any other.
  const counters = new Map()
  const numbered = survivors.map(entry => {
    // Configs with no remark share an implicit `config-` sequence (V4).
    const base = entry.remark || 'config'
    const n = (counters.get(base) || 0) + 1
    counters.set(base, n)
    return withRemark(entry.link, `${base}-${String(n).padStart(3, '0')}`)
  })

  return { links: numbered, dropped, kept }
}
