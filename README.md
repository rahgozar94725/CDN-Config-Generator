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

## How to Use

### 1. Input Raw Configs

Paste Xray config links in the **Raw Configs** field, one per line. Supported formats:

```
vless://uuid@example.com:443?type=ws&security=tls&path=%2F#my-server
trojan://password@example.com:443?type=ws&security=tls&sni=sni.example.com#trojan-box
vmess://eyJ2IjoiMiIsInBzIjoibSIsImFkZCI6...
```

**Note:** Only configs with transport type `ws`, `xhttp`, `httpupgrade`, or `grpc` are processed. Other transports pass through unchanged.

### 2. Input CDN List

Enter CDN IP addresses or domain names in the **CDN List** field, one per line:

```
1.1.1.1
2.2.2.2
cdn.example.com
```

**Important:** The CDN hosts you enter must be capable of proxying traffic for the domain in your original config address. The generated links replace the original address with the CDN host while preserving your original domain in the `host` and `sni` parameters — so the CDN must be configured to route requests for your domain to your origin server.

### 3. Configure Settings

- **TLS / No-TLS:** Toggle each mode on/off. At least one must be active.
- **Ports:** Select ports for each active mode (No-TLS defaults: 80; TLS defaults: 443). At least one port required per active mode.
- **TLS Advanced (when TLS is on):**
  - **ALPN:** Select one or more protocols (h3, h2, http/1.1, or combos). At least one required.
  - **Fingerprint:** Select one or more fingerprints (chrome, firefox, safari, edge, android, random, randomized). At least one required.
  - **Random SNI:** Toggle to replace SNI with 8-12 random chars + root domain + trailing dot (FQDN bypass).

### 4. Generate

Click **Generate**. A progress bar shows processing per config. No browser freeze.

### 5. Output

- **Copy All:** Copies all generated links to clipboard.
- **Download .txt:** Saves all links as a `.txt` file.

### Example

**Input (raw config):**
```
vless://a1b2c3d4@shop.ir:443?type=ws&security=tls&path=%2Fconnect#cdn-node
```

**CDN List:**
```
1.1.1.1
2.2.2.2
```

**Settings:** TLS on, port 443, ALPN: h2, Fingerprint: chrome, Random SNI: off

**Generated output (2 links):**
```
vless://a1b2c3d4@1.1.1.1:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-001
vless://a1b2c3d4@2.2.2.2:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-002
```

## Local Setup

Choose one:

### A. Quick (no install — use online)

Open the app directly in your browser via GitHub Pages (if deployed) or use the hosted version at your CDN provider.

### B. Run locally

```bash
git clone https://github.com/rahgozar94725/CDN-Config-Generator.git
cd CDN-Config-Generator
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

### C. Build for production

```bash
npm run build
```

Serve the `dist/` folder with any static file server (Nginx, Caddy, Vercel, Netlify, etc.).

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
