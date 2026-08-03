# SPEC — Xray Config Multiplier & CDN Link Generator

## §G

Xray raw config (VLESS/VMESS/Trojan) × CDN IP list × port/TLS combo = expanded link list. SPA. Vue 3.

## §C

1.  Vue 3 + Vite + Tailwind CSS + vue-i18n. SPA no SSR.
2.  i18n: EN default, FA (RTL), RU, ZH. Persistent lang toggle.
3.  Input A: raw configs line-separated. Support `vless://`, `vmess://`, `trojan://`, `ss://` (Xray-native dialect only; `plugin=` refused).
4.  Input B: CDN IP/domain one-per-line.
5.  Toggle TLS mode + No-TLS mode. Both default ON.
6.  Port lists: No-TLS [80,8080,8880,2052,2082,2086,2095] default 80. TLS [443,2053,2083,2087,2096,8443] default 443. ≥1 per active mode.
7.  TLS advanced: ALPN multi-select, fingerprint multi-select, random SNI toggle (8-12 rand chars + `.` + orig host + `.`).
8.  Compatibility gate: transport ∈ {`ws`,`xhttp`,`httpupgrade`,`grpc`} ∧ security ∈ {`none`,`tls`} ∧ (no `flow` ∨ VLESS Encryption present). Excluded rows are labelled with a reason and left out of the output; opt-in checkbox copies them through raw.
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
- **I.parse** — URL pattern matching for vless:// vmess:// trojan:// ss://
- **I.theme** — localStorage key `cdn-cfg-theme` (light|dark|system). Tailwind `darkMode: class`

## §V

| id | invariant | check |
|----|-----------|-------|
| V1 | Output count = compatible-row count × active IPs × active ports × TLS combos (if TLS), plus excluded-row count when `includeExcluded`. No dedup loss | unit test counter |
| V2 | Processed configs have `security=tls` or `security=none` only | regex output scan |
| V3 | ∀ processed config → link `host`==`sni`==config routingSubdomain. Connect address never appears in `host`/`sni` | param scan + parser matrix test |
| V4 | Remark suffix = 3-digit incrementing 001-N. No gaps | output scan |
| V5 | Excluded rows never reach the output unless `includeExcluded`; when they do, bit-identical to the input line | string equality test |
| V6 | Active TLS/No-TLS mode must have ≥1 port selected | form validation before compute |
| V7 | ∀ random SNI → root domain of routingSubdomain (last 2 labels), subdomain prefix stripped | random SNI output test |
| V8 | ∀ TLS mode → alpn.length ≥ 1 ∧ fingerprint.length ≥ 1 | form validation + multiplier test |
| V9 | Theme choice persisted to localStorage and restored on load. `dark` class on `<html>` matches choice | DOM check + reload test |
| V10 | ∀ processed config → generation blocked before compute when resolved routingSubdomain (override ?? derivation) is empty or fails V14 | rows unit test + form gate |
| V11 | routingSubdomain derivation: explicit `host` param wins → hostname connect address → else required. Input `sni` never consulted | parser matrix test |
| V12 | ∀ routing-subdomain field edit → written to override map keyed by config fingerprint; effective rows re-resolve so the validation gate re-triggers. No `.map(reactive)` over a computed. Override presence — not truthiness — selects: `''` is a stored value, not an absent one | rows unit test (resolve) + UI verify |
| V13 | Generate gate requires ≥1 compatible row regardless of `includeExcluded`; excluded-only input disables Generate (no silent empty output, no echoing the paste back) | generation unit test + form gate |
| V14 | routingSubdomain validity, applied to the resolved value regardless of source: ≥2 labels, per-label `[A-Za-z0-9]` with inner `-` only and ≤63 chars, ≤253 total, no trailing dot, not an IP, no `xn--` label. Case preserved, never normalised | rows unit test (validate) |
| V15 | ∀ generated link → `host` carries no trailing dot; a trailing dot appears only in `sni` under random SNI, and root-domain extraction ignores one if present | multiplier unit test |
| V16 | Compatibility is an allowlist on both axes: an unrecognised transport or an unrecognised `security` is excluded, never rewritten. No param is stripped to make a config fit — `flow` is either legitimate (VLESS Encryption present) or the whole config is excluded | rows unit test (compatibilityReason) |
| V17 | Every non-blank input line is exactly one row carrying its source line index; deletion addresses lines by that index, so one of two identical lines can be removed | generation unit test (parseRows, removeLines) |
| V18 | ss credential segment reaches generated links byte-for-byte as it arrived — no base64 decode, no SIP002/SIP022 distinction. `plugin=` links are excluded with their own reason, never blamed on the transport | parser + rows unit tests |

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
| T12 | x | compatibility gate: security/flow rules, row status, reason messages, passthrough checkbox | C8,V1,V5,V13,V16,V17 |
| T13 | x | per-row and bulk deletion; InputPanel becomes controlled | V17 |
| T14 | x | ss:// support, Xray-native dialect only | C3,I.parse,V18 |

## §B

| id | date | cause | fix |
| B1 | 2026-06-11 | genRandomSni used full hostname instead of root domain | V7 |
| B2 | 2026-06-11 | TLS enabled but alpn/fingerprint empty — generated incomplete TLS configs | V8 |
| B3 | 2026-07-31 | parsed rows plain objects from computed — routingSubdomain edits never re-triggered missingRows gate, retry dead | V12 |
| B4 | 2026-08-03 | editable routingSubdomain lived inside a recomputed derived value — a raw-config re-parse silently discarded typed entries (latent data loss); `.map(reactive)` only masked B3's gate, not ownership | V12 |
| B5 | 2026-08-03 | override resolution keyed on truthiness, so clearing a derivable field deleted a key that was never set: the resolved value did not change, Vue skipped the DOM patch, and field and model diverged — screen empty, links still carrying the deleted value | V10, V12 |
| B6 | 2026-08-03 | CDN subdomain field validated emptiness only — `abc`, `1.2.3.4`, `MY_Host!!` and `example.com.` all reached `host`/`sni`; with random SNI the trailing-dot case emitted root `com.` and an SNI of `rand.com..` | V14, V15 |
| B7 | 2026-08-03 | only transport was gated. `security` was never examined, so REALITY with an allowed transport was rewritten to `security=tls` with `pbk`/`sid`/`spx` still attached; `flow` was never examined either. Everything else passed through raw into the output, indistinguishable from a generated link | V5, V13, V16 |
