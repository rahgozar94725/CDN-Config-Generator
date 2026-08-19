# CDN Config Generator

Vue 3 + Vite + Tailwind SPA, no backend. Deployed to GitHub Pages.

@AGENTS.md

## Commands

```bash
npm run dev     # vite dev server
npm run test    # vitest run (colocated src/utils/*.test.js + src/meta/*.test.js)
npm run build   # vite build -> dist/
```

## Layout

- `src/utils/` — all logic, pure and unit-tested: `parser` → `rows` (compatibility gate) →
  `multiplier` (link building) → `dedup` (identity + numbering) → `generation` (pipeline).
- `src/meta/` — repo gates, no imports, files read from disk: `traceability` (every `SPEC.md` §V
  row has a test carrying its id, and every cited §V row / ADR resolves), `locales` (the four
  locale files share one key set, and every key is rendered under `src/`), `bidi` (no Latin run in
  `fa.json` ends on a reversing neutral, no bidi control characters).
- `src/components/` — Vue only, no generation logic.
- `src/i18n/locales/{en,fa,ru,zh}.json` — every user string; `fa` is RTL (see `docs/agents/persian-style.md`).

## Gotchas

- CI (`.github/workflows/ci.yml`, job `test`) runs `npm ci --ignore-scripts` + `npm run test` + `npm run build` on every pull request, and a `master` ruleset requires that check — **a red suite blocks the merge**. `deploy.yml` is Pages-only (build on push to `master`) and gates nothing.
- Four gates turn the suite red: the three `src/meta/` suites, plus the V19 round-trip gate below.
- `vite.config.js` sets `base: '/CDN-Config-Generator/'`. Absolute asset paths break locally and in prod.
- `src/utils/roundtrip.js` is the V19 round-trip gate: every generated link must re-parse through an *independent* decoder. Its EXPECT map is a spec taken from each scheme's grammar — never update it to match `multiplier.js` (that was the ADR-0007 defect).
- Spec invariants live in `SPEC.md` §V; domain vocabulary in `CONTEXT.md`. Changing behaviour means updating the matching V-row.
