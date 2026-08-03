import { parseConfig } from './parser.js'
import { generateConfigs } from './multiplier.js'
import { findInvalidRoutingSubdomain } from './rows.js'

export function splitLines(text) {
  return text.split('\n').map(s => s.trim()).filter(Boolean)
}

export function parseRows(raw) {
  return splitLines(raw).map(parseConfig).filter(Boolean)
}

export function canGenerate(rows, cdnList, options) {
  const {
    enableTls = true,
    enableNoTls = true,
    noTlsPorts = [80],
    tlsPorts = [443],
    alpn = [],
    fingerprint = [],
  } = options || {}

  const hasInput = rows.length > 0 && cdnList.length > 0
  const hasPorts = (enableTls && tlsPorts.length > 0) || (enableNoTls && noTlsPorts.length > 0)
  const hasAlpn = !enableTls || alpn.length > 0
  const hasFingerprint = !enableTls || fingerprint.length > 0
  return hasInput && hasPorts && hasAlpn && hasFingerprint && findInvalidRoutingSubdomain(rows).length === 0
}

export async function generateLinks(rows, cdnList, options, onProgress) {
  const results = []
  const total = rows.length
  let current = 0

  for (const config of rows) {
    const batch = generateConfigs([config], cdnList, options)
    results.push(...batch)
    current++
    if (onProgress) onProgress(current, total)
    await new Promise(r => setTimeout(r, 0))
  }

  return results
}
