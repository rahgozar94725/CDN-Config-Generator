import { decodeBase64 } from './parser.js'

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
function queryLinkIdentity(link) {
  const { head } = splitFragment(link)
  const q = head.indexOf('?')
  if (q === -1) return head
  const pairs = head.slice(q + 1).split('&').filter(Boolean).sort()
  return `${head.slice(0, q)}?${pairs.join('&')}`
}

// vmess is base64 of a JSON object in either of two encodings: bare UTF-8 JSON
// bytes, or percent-encoded JSON (our own generator percent-encodes before
// base64, so it decodes to a still-encoded string). Tolerate both so a link
// dedups against its own kind whether it was built here or pasted raw.
function vmessConfig(link) {
  const raw = decodeBase64(link.replace('vmess://', ''))
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(decodeURIComponent(raw))
  }
}

// vmess states its identity inside a base64 JSON object rather than the URL, and
// its remark is the `ps` field, so identity is the decoded config with `ps`
// dropped. Keys are sorted for a canonical string so field order does not matter
// either. This being a string that only ever meets other vmess keys (a vmess
// link cannot equal a vless one), cross-scheme collisions are impossible.
function vmessIdentity(link) {
  let obj
  try {
    obj = vmessConfig(link)
  } catch {
    return ''
  }
  delete obj.ps
  const sorted = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key]
    return acc
  }, {})
  return JSON.stringify(sorted)
}

export function linkIdentity(link) {
  if (isVmess(link)) return `vmess:${vmessIdentity(link)}`
  return queryLinkIdentity(link)
}

// Rewrites a numbered remark back into a link. vless/trojan/ss carry it as a
// percent-encoded fragment; vmess as the `ps` field of its base64 JSON object,
// re-encoded exactly as the multiplier builds it so it still parses back.
function withRemark(link, remark) {
  if (isVmess(link)) {
    const obj = vmessConfig(link)
    obj.ps = remark
    return 'vmess://' + btoa(encodeURIComponent(JSON.stringify(obj)))
  }
  return `${splitFragment(link).head}#${encodeURIComponent(remark)}`
}

// Entries are `{ link, remark }` pairs: the built origin link plus its base
// remark (the routing context). The engine deduplicates first-wins on link
// identity, then numbers the survivors per remark text across the whole run.
export function dedupeAndNumber(entries) {
  const seen = new Set()
  const survivors = []
  for (const entry of entries) {
    const id = linkIdentity(entry.link)
    if (seen.has(id)) continue
    seen.add(id)
    survivors.push(entry)
  }

  const dropped = entries.length - survivors.length
  const counters = {}
  const numbered = survivors.map(entry => {
    const n = (counters[entry.remark] = (counters[entry.remark] || 0) + 1)
    const suffix = String(n).padStart(3, '0')
    // Configs with no remark share an implicit `config-` sequence (V4).
    const label = entry.remark ? `${entry.remark}-${suffix}` : `config-${suffix}`
    return withRemark(entry.link, label)
  })

  return { links: numbered, dropped }
}
