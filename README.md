# CDN Config Generator

**Xray Config Multiplier & CDN Link Generator**

[فارسی](README.fa.md) | [Русский](README.ru.md) | [中文](README.zh.md)

A browser-based SPA that takes raw Xray configs (VLESS / VMESS / Trojan / Shadowsocks), multiplies them across CDN IPs, ports, and TLS settings — producing an expanded list of ready-to-use links.

**Live:** [https://rahgozar94725.github.io/CDN-Config-Generator/](https://rahgozar94725.github.io/CDN-Config-Generator/)

## Features

- **Input:** Paste raw configs and CDN IP/domain list
- **CDN subdomain field:** Per-config routing subdomain, auto-filled and editable, with apply-to-all
- **Compatibility check:** configs a CDN cannot carry are listed with the reason, kept out of the output, and deletable one by one or all at once
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
ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@example.com:443?type=ws&security=tls#ss-box
```

### What a CDN can carry

A config is only rewritten when all three hold:

- transport is `ws`, `xhttp`, `grpc` or `httpupgrade`
- transport security is `none` or `tls` — REALITY cannot pass a CDN
- it declares no `flow`, or declares one together with VLESS Encryption

Anything else gets a row explaining why it was excluded, and stays out of the
output. Each row has a delete control, and one button removes every excluded row
at once. Turn on **Include excluded configs in the output** if you pasted a mixed
subscription and want the untouched lines back in the same list.

Shadowsocks is read in the Xray-native dialect, where the transport is stated in
the query string as it is for VLESS. The older `plugin=` form is not supported:
it cannot carry ALPN or fingerprint, and its SNI is pinned to the routing
subdomain.

### 2. Input CDN List

Enter CDN IP addresses or domain names in the **CDN List** field, one per line:

```
1.1.1.1
2.2.2.2
cdn.example.com
```

**Important:** The CDN hosts you enter must be capable of proxying traffic for your routing subdomain. The generated links replace the connect address with the CDN host and write the CDN subdomain field's value into the `host` and `sni` parameters — so the CDN must be configured to route requests for that subdomain to your origin server.

### 3. CDN Subdomain

After pasting configs, each one appears as a row with a **CDN subdomain** field. This field holds the routing identity written into the generated link's `host` and `sni` parameters — the value the CDN uses to route traffic to your origin server.

**Auto-fill order:**
1. Explicit `host` param from the origin config (wins)
2. Connect address, if it is a hostname (not an IP)
3. Otherwise empty — you must fill it

**Required field:** When the connect address is an IP and no `host` param exists, the field is empty and generation is blocked with a per-row error. Enter the routing subdomain (e.g. `sub.example.com`) to proceed.

**Apply to all:** Use the apply-to-all input to fill every row with the same value in one click.

### 4. Configure Settings

- **TLS / No-TLS:** Toggle each mode on/off. At least one must be active.
- **Ports:** Select ports for each active mode (No-TLS defaults: 80; TLS defaults: 443). At least one port required per active mode.
- **TLS Advanced (when TLS is on):**
  - **ALPN:** Select one or more protocols (h3, h2, http/1.1, or combos). At least one required.
  - **Fingerprint:** Select one or more fingerprints (chrome, firefox, safari, edge, android, random, randomized). At least one required.
  - **Random SNI:** Toggle to replace SNI with 8-12 random chars + root domain + trailing dot (FQDN bypass).

### 5. Generate

Click **Generate**. A progress bar shows processing per config. No browser freeze.

### 6. Output

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

**CDN subdomain:** Auto-filled to `shop.ir` (hostname connect address, no explicit `host` param).

**Generated output (2 links):**
```
vless://a1b2c3d4@1.1.1.1:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-001
vless://a1b2c3d4@2.2.2.2:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-002
```

## Local Setup

Choose one:

### A. Run locally

```bash
git clone https://github.com/rahgozar94725/CDN-Config-Generator.git
cd CDN-Config-Generator
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

### B. Build for production

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

## Support

If you find this tool useful and want to support its development, consider making a donation. Your contributions help keep the project alive and improving.

**Donate with crypto:**

<a href="https://nowpayments.io/donation?api_key=d824db3b-fcf7-4ebb-8e3d-297c23cfeee2" target="_blank" rel="noreferrer noopener">
  <img src="https://nowpayments.io/images/embeds/donation-button-black.svg" alt="Crypto donation button by NOWPayments">
</a>

## License

MIT
