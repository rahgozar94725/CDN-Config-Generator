export function parseConfig(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('vless://')) return parseVless(trimmed)
  if (trimmed.startsWith('vmess://')) return parseVmess(trimmed)
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed)

  return null
}

export function parseVless(raw) {
  try {
    const u = new URL(raw)
    const port = Number(u.port) || 443
    const params = Object.fromEntries(u.searchParams.entries())
    return {
      type: 'vless',
      uuid: u.username || '',
      address: u.hostname,
      port,
      transport: params.type || '',
      security: params.security || 'none',
      remark: decodeURIComponent(u.hash.replace('#', '')),
      params,
      raw,
    }
  } catch {
    return null
  }
}

export function parseTrojan(raw) {
  try {
    const u = new URL(raw)
    const port = Number(u.port) || 443
    const params = Object.fromEntries(u.searchParams.entries())
    return {
      type: 'trojan',
      uuid: u.username || '',
      address: u.hostname,
      port,
      transport: params.type || '',
      security: params.security || 'none',
      remark: decodeURIComponent(u.hash.replace('#', '')),
      params,
      raw,
    }
  } catch {
    return null
  }
}

export function parseVmess(raw) {
  try {
    const b64 = raw.replace('vmess://', '')
    const decoded = decodeBase64(b64)
    const json = JSON.parse(decoded)
    return {
      type: 'vmess',
      uuid: json.id || '',
      address: json.add || '',
      port: Number(json.port) || 443,
      transport: json.net || '',
      security: normalizeVmessSecurity(json.tls),
      remark: json.ps || '',
      params: {
        host: json.host || '',
        path: json.path || '',
        sni: json.sni || '',
        alpn: json.alpn || '',
        fp: json.fp || json.fingerprint || '',
        aid: json.aid || '0',
        scy: json.scy || 'auto',
        headerType: json.type || 'none',
        v: json.v || '2',
      },
      raw,
    }
  } catch {
    return null
  }
}

function decodeBase64(str) {
  try {
    const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
    return decodeURIComponent(atob(padded).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
  } catch {
    try {
      const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
      return atob(padded)
    } catch {
      return ''
    }
  }
}

function normalizeVmessSecurity(tls) {
  if (!tls || tls === 'none') return 'none'
  return 'tls'
}
