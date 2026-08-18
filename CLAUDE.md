# CDN Config Generator

Vue 3 + Vite + Tailwind SPA, no backend. Deployed to GitHub Pages.

@AGENTS.md

## Commands

```bash
npm run dev     # vite dev server
npm run test    # vitest run (colocated src/utils/*.test.js)
npm run build   # vite build -> dist/
```

## Layout

- `src/utils/` — all logic, pure and unit-tested: `parser` → `rows` (compatibility gate) →
  `multiplier` (link building) → `dedup` (identity + numbering) → `generation` (pipeline).
- `src/components/` — Vue only, no generation logic.
- `src/i18n/locales/{en,fa,ru,zh}.json` — every user string; `fa` is RTL (see `docs/agents/persian-style.md`).

## Gotchas

- CI (`.github/workflows/deploy.yml`) runs only `npm ci` + `npm run build` — **tests do not gate a merge**. Run `npm run test` yourself before saying a change is safe.
- `vite.config.js` sets `base: '/CDN-Config-Generator/'`. Absolute asset paths break locally and in prod.
- `src/utils/roundtrip.js` is the V19 round-trip gate: every generated link must re-parse through an *independent* decoder. Its EXPECT map is a spec taken from each scheme's grammar — never update it to match `multiplier.js` (that was the ADR-0007 defect).
- Spec invariants live in `SPEC.md` §V; domain vocabulary in `CONTEXT.md`. Changing behaviour means updating the matching V-row.
