# Local knowledge

What the repository cannot tell you by being read. Hand-written, and the one
part of grounding that is committed — `ground.md` beside it is a cache.

- Test command is `npm run test` (`vitest run`).
- Two workflows, and they do different jobs. `.github/workflows/ci.yml` runs `npm ci` + `npm run test` on every pull request and on pushes to master — added by U1, commit `11ef1ad`. `.github/workflows/deploy.yml` runs `npm ci` + `npm run build` and publishes to GitHub Pages on pushes to master and on manual dispatch. The line that used to sit here said CI only builds and never tests; that described `deploy.yml`, and it stopped being true of the repo as a whole when U1 landed.
- Whether a red check actually blocks a merge is branch protection — a repository setting, not a file, so no amount of reading the tree settles it. Settled since: ruleset 21038975 on `master` requires the `test` check, and throwaway pull request #21 (`r7-build-gate-probe`) was watched going red on it — run 32257236772, build step failing after the suite passed. Recorded in `.evidence/work/2026-08-18-governance-ci-four-gates-fixes/R7.md`. The earlier line here said no pull request had ever been opened; #20 and #21 have been.
- The vitest config has no file of its own — it is the `test:` key inside `vite.config.js`, and the tests are colocated `src/**/*.test.js` rather than under a `tests/` directory. `ev-ground` cannot see either, so it reports the test framework as UNKNOWN on every run. It is vitest.
- Vue 3 + Vite + Tailwind SPA, deployed to GitHub Pages under base `/CDN-Config-Generator/`.
- `AGENTS.md` points at further agent docs: `docs/agents/{issue-tracker,triage-labels,domain,persian-style}.md`, `docs/adr/`, `docs/solutions/`, `CONTEXT.md`.
