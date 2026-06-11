# CDN Config Generator

**Xray Config Multiplier & CDN Link Generator**

[فارسی](README.fa.md) | [Русский](README.ru.md) | [中文](README.zh.md)

A browser-based SPA that takes raw Xray configs (VLESS / VMESS / Trojan), multiplies them across CDN IPs, ports, and TLS settings — producing an expanded list of ready-to-use links.

## Features

- **Input:** Paste raw configs and CDN IP/domain list
- **TLS / No-TLS toggle** — both modes with independent port selection
- **TLS Advanced:**
  - ALPN multi-select (h3, h2, http/1.1 and combos)
  - Fingerprint multi-select (chrome, firefox, safari, edge, android, random, randomized)
  - Random SNI (8-12 random chars + root domain + trailing dot, FQDN bypass)
- **Output:** Copy all to clipboard or download as `.txt`
- **Selectable theme:** Light / Dark / System
- **i18n:** English, فارسی (Persian), Русский (Russian), 中文 (Chinese) — RTL support for Persian
- **Non-blocking:** Progress bar during generation, no browser freeze

## Stack

- Vue 3 + Vite + Tailwind CSS + vue-i18n
- Vitest for unit tests
- Single-page application (no SSR)

## Dev

```bash
npm install
npm run dev     # development server
npm run build   # production build
npm test        # run tests
```

## License

MIT
