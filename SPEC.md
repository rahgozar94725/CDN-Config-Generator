# SPEC — Xray Config Multiplier & CDN Link Generator

## §G

Xray raw config (VLESS/VMESS/Trojan) × CDN IP list × port/TLS combo = expanded link list. SPA. Vue 3.

## §C

1.  Vue 3 + Vite + Tailwind CSS + vue-i18n. SPA no SSR.
2.  i18n: EN default, FA (RTL), RU, ZH. Persistent lang toggle.
3.  Input A: raw configs line-separated. Support `vless://`, `vmess://`, `trojan://`.
4.  Input B: CDN IP/domain one-per-line.
5.  Toggle TLS mode + No-TLS mode. Both default ON.
6.  Port lists: No-TLS [80,8080,8880,2052,2082,2086,2095] default 80. TLS [443,2053,2083,2087,2096,8443] default 443. ≥1 per active mode.
7.  TLS advanced: ALPN multi-select, fingerprint multi-select, random SNI toggle (8-12 rand chars + `.` + orig host + `.`).
8.  Filter: only `ws`,`xhttp`,`httpupgrade`,`grpc` transport processed. Others passthrough unchanged.
9.  Param mapping: new addr=IP_B, new port=selected, orig addr → `host`+`sni`. TLS→`security=tls`,`insecure=0`,`allowInsecure=0`. No-TLS→`security=none`.
10. Remark suffix: 3-digit incrementing (`#name-001`).
11. Progress bar. Copy All + Download .txt.
12. Responsive mobile+desktop.
13. No browser freeze. Computation non-blocking.
14. Theme: dark mode selectable via toggle (light / dark / system). Persisted in localStorage.

## §I

- **I.ui** — Browser SPA, Vue components
- **I.i18n** — vue-i18n locale JSON files (en/fa/ru/zh)
- **I.clip** — navigator.clipboard API
- **I.dl** — Blob + URL.createObjectURL for .txt download
- **I.parse** — URL pattern matching for vless:// vmess:// trojan://
- **I.theme** — localStorage key `cdn-cfg-theme` (light|dark|system). Tailwind `darkMode: class`

## §V

| id | invariant | check |
|----|-----------|-------|
| V1 | Output count = input count × active IPs × active ports × TLS combos (if TLS). No dedup loss | unit test counter |
| V2 | Processed configs have `security=tls` or `security=none` only | regex output scan |
| V3 | Original address always moves to `host`+`sni` for processed configs | param diff test |
| V4 | Remark suffix = 3-digit incrementing 001-N. No gaps | output scan |
| V5 | Non-ws/xhttp/httpupgrade/grpc transport configs passthrough bit-identical | string equality test |
| V6 | Active TLS/No-TLS mode must have ≥1 port selected | form validation before compute |
| V7 | ∀ random SNI → root domain extracted (last 2 labels), subdomain prefix stripped | random SNI output test |
| V8 | ∀ TLS mode → alpn.length ≥ 1 ∧ fingerprint.length ≥ 1 | form validation + multiplier test |
| V9 | Theme choice persisted to localStorage and restored on load. `dark` class on `<html>` matches choice | DOM check + reload test |

## §T

| id | status | task | cites |
|----|--------|------|-------|
| T1 | x | scaffold Vue 3 + Vite + Tailwind + vue-i18n | C1 |
| T2 | x | i18n setup EN/FA/RU/ZH. RTL support. Lang toggle persistent | C2,I.i18n |
| T3 | x | textarea A input (raw configs). textarea B input (CDN list) | C3,C4 |
| T4 | x | config panel: TLS/No-TLS toggle, port multi-select, TLS advanced (ALPN/fingerprint/random SNI) | C5,C6,C7,V6 |
| T5 | x | parser module: extract type/uuid/addr/port/params/frag from vless:// vmess:// trojan:// | C3,I.parse |
| T6 | x | multiplier engine: filter transport, map params, combine IP×port×TLS | C8,C9,V1,V2,V3,V5 |
| T7 | x | output list display + progress bar during generation | C11,C13 |
| T8 | x | Copy All (clipboard) + Download .txt | C11,I.clip,I.dl,V4 |
| T9 | x | responsive UI polish mobile+desktop | C12 |
| T10 | x | edge case handling: malformed URL, empty input, large list (non-blocking) | C13 |
| T11 | x | theme switcher UI: light/dark/system toggle, localStorage persist | C14,I.theme,V9 |

## §B

| id | date | cause | fix |
| B1 | 2026-06-11 | genRandomSni used full hostname instead of root domain | V7 |
| B2 | 2026-06-11 | TLS enabled but alpn/fingerprint empty — generated incomplete TLS configs | V8 |
