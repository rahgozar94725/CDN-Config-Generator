# Local knowledge

What the repository cannot tell you by being read. Hand-written, and the one
part of grounding that is committed — `ground.md` beside it is a cache.

- Test command is `npm run test` (`vitest run`); CI only runs `npm ci` + `npm run build`, so tests do NOT gate a merge.
- Vue 3 + Vite + Tailwind SPA, deployed to GitHub Pages under base `/CDN-Config-Generator/`.
- `AGENTS.md` points at further agent docs: `docs/agents/{issue-tracker,triage-labels,domain,persian-style}.md`, `docs/adr/`, `docs/solutions/`, `CONTEXT.md`.
