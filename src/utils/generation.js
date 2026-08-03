import { parseConfig } from './parser.js'
import { generateConfigs } from './multiplier.js'
import {
  compatibilityReason,
  findInvalidRoutingSubdomain,
  ROW_INCOMPATIBLE,
  ROW_OK,
  ROW_UNPARSED,
} from './rows.js'

export function splitLines(text) {
  return text.split('\n').map(s => s.trim()).filter(Boolean)
}

// Every non-blank input line becomes exactly one row, including lines that do
// not parse (ADR-0004). Nothing the user pasted disappears without account, and
// because no row is filtered away each one can carry the index of the line it
// came from, which is all per-row deletion needs.
export function parseRows(raw) {
  return raw.split('\n')
    .map((text, line) => ({ text: text.trim(), line }))
    .filter(entry => entry.text)
    .map(entry => toRow(entry.text, entry.line))
}

function toRow(text, line) {
  const config = parseConfig(text)
  if (!config) {
    return {
      status: ROW_UNPARSED,
      incompatibleReason: null,
      line,
      raw: text,
      type: '',
      transport: '',
      address: '',
      remark: '',
      params: {},
      routingSubdomain: '',
    }
  }
  const incompatibleReason = compatibilityReason(config)
  return {
    ...config,
    line,
    incompatibleReason,
    status: incompatibleReason ? ROW_INCOMPATIBLE : ROW_OK,
  }
}

export function compatibleRows(rows) {
  return rows.filter(row => row && row.status === ROW_OK)
}

export function excludedRows(rows) {
  return rows.filter(row => row && row.status !== ROW_OK)
}

// Deletion rewrites the user's own pasted text, so it addresses lines by their
// original index rather than by row position or fingerprint: two identical lines
// are two rows sharing one fingerprint, and deleting one must not take both.
export function removeLines(raw, lines) {
  const drop = new Set(lines)
  return raw.split('\n').filter((_, index) => !drop.has(index)).join('\n')
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

  // At least one compatible row, whatever the passthrough checkbox says: with
  // none, "generating" would hand the user back the text they pasted.
  const hasInput = compatibleRows(rows).length > 0 && cdnList.length > 0
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
