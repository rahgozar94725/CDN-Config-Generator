import { parseConfig } from './parser.js'
import { generateConfigs } from './multiplier.js'
import { dedupeAndNumber } from './dedup.js'
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

// The whole-run pipeline (V1, V4): links are built per config, collected with
// their base remark, then deduplicated and numbered over all of them at once.
// Numbering is the engine's last step, over the survivors, so a label reads
// `001-N` with no holes and two configs sharing a remark get unique labels. The
// multiplier's own per-batch suffix is irrelevant here — the engine strips the
// fragment it wrote and re-numbers from the base remark. Passthrough raw lines
// are the user's own text: copied through bit-identical, never deduplicated.
//
// Dedup is a whole-run step but the output is still the user's list in the order
// they pasted it (V5): every item carries the position it was produced at, and
// the survivors are merged back with the passthrough lines by that position. A
// raw line therefore sits where its row sits, not after every generated link.
export async function generateLinks(rows, cdnList, options, onProgress) {
  const entries = []
  const passthrough = []
  const total = rows.length
  let current = 0
  let position = 0
  const includeExcluded = !!(options && options.includeExcluded)
  const randomSni = !!(options && options.randomSni)

  for (const config of rows) {
    if (config.status !== ROW_OK) {
      if (includeExcluded) passthrough.push({ position: position++, text: config.raw })
    } else {
      const batch = generateConfigs([config], cdnList, options)
      for (const link of batch) {
        entries.push({ link, remark: config.remark, position: position++ })
      }
    }
    current++
    if (onProgress) onProgress(current, total)
    await new Promise(r => setTimeout(r, 0))
  }

  const { links: deduped, dropped, kept } = dedupeAndNumber(entries, { randomSni })
  const merged = deduped
    .map((text, i) => ({ position: entries[kept[i]].position, text }))
    .concat(passthrough)
    .sort((a, b) => a.position - b.position)
    .map(item => item.text)
  return { links: merged, dropped }
}
