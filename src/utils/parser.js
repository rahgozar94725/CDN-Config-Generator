export function parseConfig(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('vless://')) return parseVless(trimmed)
  if (trimmed.startsWith('vmess://')) return parseVmess(trimmed)
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed)
  if (trimmed.startsWith('ss://')) return parseSs(trimmed)

  return null
}

export function parseVless(raw) {
  try {
    const u = new URL(raw)
    const port = Number(u.port) || 443
    const params = Object.fromEntries(u.searchParams.entries())
    return withRoutingSubdomain({
      type: 'vless',
      uuid: u.username || '',
      address: u.hostname,
      port,
      transport: params.type || '',
      security: params.security || 'none',
      remark: decodeURIComponent(u.hash.replace('#', '')),
      params,
      raw,
    })
  } catch {
    return null
  }
}

export function parseTrojan(raw) {
  try {
    const u = new URL(raw)
    const port = Number(u.port) || 443
    const params = Object.fromEntries(u.searchParams.entries())
    return withRoutingSubdomain({
      type: 'trojan',
      uuid: u.username || '',
      address: u.hostname,
      port,
      transport: params.type || '',
      security: params.security || 'none',
      remark: decodeURIComponent(u.hash.replace('#', '')),
      params,
      raw,
    })
  } catch {
    return null
  }
}

// Shadowsocks is an ordinary Xray proxy protocol over the shared transport
// layer, so its links state the transport in query params exactly as VLESS does
// (ADR-0005). The credential segment is split off by hand and carried verbatim:
// `new URL` would break SIP022's `method:password` on the colon, and treating
// it as opaque means nothing here has to know base64 from percent-encoding.
export function parseSs(raw) {
  try {
    const body = raw.slice('ss://'.length)
    const at = body.indexOf('@')
    if (at <= 0) return null
    const u = new URL('ss://' + body.slice(at + 1))
    const params = Object.fromEntries(u.searchParams.entries())
    return withRoutingSubdomain({
      type: 'ss',
      uuid: body.slice(0, at),
      address: u.hostname,
      port: Number(u.port) || 443,
      transport: params.type || '',
      security: params.security || 'none',
      remark: decodeURIComponent(u.hash.replace('#', '')),
      params,
      raw,
    })
  } catch {
    return null
  }
}

export function parseVmess(raw) {
  try {
    const b64 = raw.replace('vmess://', '')
    const decoded = decodeBase64(b64)
    const json = JSON.parse(decoded)
    return withRoutingSubdomain({
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
    })
  } catch {
    return null
  }
}

function withRoutingSubdomain(parsed) {
  const hostParam = parsed.params.host
  if (hostParam) {
    return { ...parsed, routingSubdomain: hostParam, routingSubdomainRequired: false }
  }
  if (parsed.address && !isIpAddress(parsed.address)) {
    return { ...parsed, routingSubdomain: parsed.address, routingSubdomainRequired: false }
  }
  return { ...parsed, routingSubdomain: '', routingSubdomainRequired: true }
}

export function isIpAddress(host) {
  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(host) || host.includes(':')
}

export function decodeBase64(str) {
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
