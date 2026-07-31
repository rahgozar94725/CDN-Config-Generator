import { ALLOWED_TRANSPORTS } from './multiplier.js'

export function findMissingRoutingSubdomain(configs) {
  const missing = []
  configs.forEach((config, index) => {
    if (!config) return
    if (!ALLOWED_TRANSPORTS.includes(config.transport)) return
    if (config.routingSubdomainRequired && !config.routingSubdomain) {
      missing.push({ index, config })
    }
  })
  return missing
}
