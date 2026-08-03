import { isIpAddress } from './parser.js'

// The CDN method carries a config only through a transport the CDN can proxy,
// under plain or ordinary TLS. Both lists are allowlists on purpose (ADR-0004):
// a blocklist would let an unrecognised `security` fall through and be rewritten
// to `security=tls`, which is the REALITY defect reproduced under a new name.
export const ALLOWED_TRANSPORTS = ['ws', 'xhttp', 'httpupgrade', 'grpc']
export const ALLOWED_SECURITY = ['none', 'tls']

export const ROW_OK = 'ok'
export const ROW_INCOMPATIBLE = 'incompatible'
export const ROW_UNPARSED = 'unparsed'

// Reasons are message keys. They stay separate because the remedies differ:
// a refused transport is the server's to change, while `flow` without VLESS
// Encryption is a config no client accepts at all.
export const INCOMPATIBLE_TRANSPORT = 'transport'
export const INCOMPATIBLE_SECURITY = 'security'
export const INCOMPATIBLE_FLOW = 'flow'
export const INCOMPATIBLE_SS_PLUGIN = 'ssPlugin'

// Stable identity for a parsed config across re-derives. Deliberately excludes
// remark and transport: "the same underlying config" means the same endpoint,
// not the same label. Identical configs share one key — they would generate
// identical links anyway, so sharing one override is correct.
export function configFingerprint(config) {
  if (!config) return ''
  return JSON.stringify([config.type, config.uuid, config.address, config.port])
}

// The CDN subdomain field has three states, not two (ADR-0003): absent from the
// map means untouched, so derivation fills it; present means the user owns it,
// including the empty string, which is a deliberate rejection of the derived
// value rather than a request to re-derive. Presence — not truthiness — is the
// signal, matching V10's `override ?? derivation`.
export function resolveRoutingSubdomain(config, overrides) {
  const key = configFingerprint(config)
  const override = overrides && overrides.get ? overrides.get(key) : undefined
  if (override !== undefined) return override
  return config.routingSubdomain || ''
}

// Returns the reason this config cannot be carried, or null when it can.
// Order matters: an `ss` link in the plugin dialect states its transport inside
// `plugin` and so carries no `type` param at all — checking the transport first
// would blame the wrong thing and send the user to fix their server (ADR-0005).
export function compatibilityReason(config) {
  if (!config) return INCOMPATIBLE_TRANSPORT
  if (config.type === 'ss' && param(config, 'plugin')) return INCOMPATIBLE_SS_PLUGIN
  if (!ALLOWED_TRANSPORTS.includes(config.transport)) return INCOMPATIBLE_TRANSPORT
  if (!ALLOWED_SECURITY.includes(config.security)) return INCOMPATIBLE_SECURITY
  if (param(config, 'flow') && !hasVlessEncryption(config)) return INCOMPATIBLE_FLOW
  return null
}

export function isCompatibleConfig(config) {
  return !!config && compatibilityReason(config) === null
}

function param(config, name) {
  return String((config.params && config.params[name]) || '').trim()
}

// VLESS Encryption is the sole reason the flow rule is conditional rather than a
// flat refusal: it is what lets Vision run off raw TCP, and therefore behind a
// CDN. `none` is the documented explicit disable, and an absent value means the
// same thing.
function hasVlessEncryption(config) {
  const value = param(config, 'encryption')
  return value !== '' && value !== 'none'
}

const LABEL = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

// Reasons are message keys, not prose: 'required' and 'trailingDot' each get
// their own UI string, everything else shares the generic one.
export const INVALID_REQUIRED = 'required'
export const INVALID_TRAILING_DOT = 'trailingDot'
export const INVALID_FORMAT = 'format'

// A routing subdomain is the identity a CDN routes on, so it must be a public
// hostname: at least two labels, ASCII, never an IP (ADR-0001). A trailing dot
// is rejected with its own reason — it is an output artefact that genRandomSni
// appends to `sni`, never part of the identity itself, so a user who typed one
// is reaching for the wrong control (ADR-0003). Case is preserved: hostnames
// are case-insensitive, so lowercasing would only make characters vanish while
// being typed. Punycode is refused outright — `xn--` is IANA-reserved, so the
// test cannot produce a false positive on a non-IDN domain.
export function validateRoutingSubdomain(value) {
  const v = (value || '').trim()
  if (!v) return INVALID_REQUIRED
  if (v.endsWith('.')) return INVALID_TRAILING_DOT
  if (v.length > 253) return INVALID_FORMAT
  if (isIpAddress(v)) return INVALID_FORMAT
  const labels = v.split('.')
  if (labels.length < 2) return INVALID_FORMAT
  if (labels.some(label => !LABEL.test(label))) return INVALID_FORMAT
  if (labels.some(label => label.toLowerCase().startsWith('xn--'))) return INVALID_FORMAT
  return null
}

// Validates the resolved value, so a subdomain derived from the origin config is
// held to the same rule as a typed one — an unusable `host` param produces the
// same broken link either way (V10). Only compatible configs are checked: an
// excluded row has no CDN subdomain field to be wrong.
export function findInvalidRoutingSubdomain(configs) {
  const invalid = []
  configs.forEach((config, index) => {
    if (!config) return
    if (!isCompatibleConfig(config)) return
    const reason = validateRoutingSubdomain(config.routingSubdomain)
    if (reason) {
      invalid.push({ index, config, reason })
    }
  })
  return invalid
}
