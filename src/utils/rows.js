import { ALLOWED_TRANSPORTS } from './multiplier.js'

// Stable identity for a parsed config across re-derives. Deliberately excludes
// remark and transport: "the same underlying config" means the same endpoint,
// not the same label. Identical configs share one key — they would generate
// identical links anyway, so sharing one override is correct.
export function configFingerprint(config) {
  if (!config) return ''
  return JSON.stringify([config.type, config.uuid, config.address, config.port])
}

// The CDN subdomain field is auto-filled from a derivable routing subdomain but
// user-editable (ADR-0001). Edits live in an override map; a non-empty override
// wins, an empty one falls back to derivation. V10's "required" state therefore
// only surfaces when both override and derivation come up empty.
export function resolveRoutingSubdomain(config, overrides) {
  const key = configFingerprint(config)
  const override = overrides && overrides.get ? overrides.get(key) : undefined
  if (override && override.trim()) return override.trim()
  return config.routingSubdomain || ''
}

export function isProcessedConfig(config) {
  return !!config && ALLOWED_TRANSPORTS.includes(config.transport)
}

export function findMissingRoutingSubdomain(configs) {
  const missing = []
  configs.forEach((config, index) => {
    if (!config) return
    if (!isProcessedConfig(config)) return
    if (config.routingSubdomainRequired && !(config.routingSubdomain || '').trim()) {
      missing.push({ index, config })
    }
  })
  return missing
}
