const ALLOWED_TRANSPORTS = ['ws', 'xhttp', 'httpupgrade', 'grpc']

export function generateConfigs(configs, cdnList, options) {
  const {
    enableTls = true,
    enableNoTls = true,
    noTlsPorts = [80],
    tlsPorts = [443],
    alpn = [],
    fingerprint = [],
    randomSni = false,
  } = options

  const results = []
  let counter = 1

  for (const config of configs) {
    if (!config) continue

    if (!ALLOWED_TRANSPORTS.includes(config.transport)) {
      results.push(config.raw)
      continue
    }

    const originalAddr = config.address

    for (const cdnIp of cdnList) {
      if (enableNoTls) {
        for (const port of noTlsPorts) {
          results.push(buildLink(config, cdnIp, port, 'none', {}, randomSni, counter++))
        }
      }

      if (enableTls) {
        for (const port of tlsPorts) {
          const alpnList = alpn.length > 0 ? alpn : ['']
          const fpList = fingerprint.length > 0 ? fingerprint : ['']
          for (const a of alpnList) {
            for (const fp of fpList) {
              const tlsParams = {}
              if (a) tlsParams.alpn = a
              if (fp) tlsParams.fp = fp
              results.push(buildLink(config, cdnIp, port, 'tls', tlsParams, randomSni, counter++))
            }
          }
        }
      }
    }
  }

  return results
}

function buildLink(config, newAddr, newPort, security, extra, randomSni, idx) {
  const suffix = String(idx).padStart(3, '0')
  const remark = config.remark ? `${config.remark}-${suffix}` : `config-${suffix}`

  const sniValue = randomSni ? genRandomSni(config.address) : config.address

  switch (config.type) {
    case 'vless':
      return buildVless(config, newAddr, newPort, security, sniValue, remark, extra)
    case 'trojan':
      return buildTrojan(config, newAddr, newPort, security, sniValue, remark, extra)
    case 'vmess':
      return buildVmess(config, newAddr, newPort, security, sniValue, remark, extra)
    default:
      return config.raw
  }
}

function buildVless(config, newAddr, newPort, security, sniValue, remark, extra) {
  const p = { ...config.params }
  p.type = p.type || config.transport
  p.host = config.address
  p.sni = sniValue
  p.security = security
  if (security === 'tls') {
    p.insecure = '0'
    p.allowInsecure = '0'
    if (extra.alpn) p.alpn = extra.alpn
    if (extra.fp) p.fp = extra.fp
  } else {
    delete p.insecure
    delete p.allowInsecure
    delete p.alpn
    delete p.fp
  }

  const qs = Object.entries(p)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  return `vless://${config.uuid}@${newAddr}:${newPort}?${qs}#${remark}`
}

function buildTrojan(config, newAddr, newPort, security, sniValue, remark, extra) {
  const p = { ...config.params }
  p.type = p.type || config.transport
  p.host = config.address
  p.sni = sniValue
  p.security = security
  if (security === 'tls') {
    p.insecure = '0'
    p.allowInsecure = '0'
    if (extra.alpn) p.alpn = extra.alpn
    if (extra.fp) p.fp = extra.fp
  } else {
    delete p.insecure
    delete p.allowInsecure
    delete p.alpn
    delete p.fp
  }

  const qs = Object.entries(p)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  return `trojan://${config.uuid}@${newAddr}:${newPort}?${qs}#${remark}`
}

function buildVmess(config, newAddr, newPort, security, sniValue, remark, extra) {
  const obj = {
    v: config.params.v || '2',
    ps: remark,
    add: newAddr,
    port: String(newPort),
    id: config.uuid,
    aid: config.params.aid || '0',
    scy: config.params.scy || 'auto',
    net: config.transport,
    type: config.params.headerType || 'none',
    host: config.address,
    path: config.params.path || '',
    sni: sniValue,
    tls: security === 'tls' ? 'tls' : 'none',
  }

  if (security === 'tls') {
    if (extra.alpn) obj.alpn = extra.alpn
    if (extra.fp) obj.fp = extra.fp
  }

  const json = JSON.stringify(obj)
  const b64 = btoa(encodeURIComponent(json))
  return 'vmess://' + b64
}

function genRandomSni(originalHost) {
  const len = 8 + Math.floor(Math.random() * 5)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let rand = ''
  for (let i = 0; i < len; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)]
  }
  const root = extractRootDomain(originalHost)
  return `${rand}.${root}.`
}

function extractRootDomain(host) {
  const parts = host.split('.')
  if (parts.length <= 2) return host
  return parts.slice(-2).join('.')
}
