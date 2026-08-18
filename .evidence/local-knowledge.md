# Local knowledge

What the repository cannot tell you by being read. Hand-written, and the one
part of grounding that is committed — `ground.md` beside it is a cache.

- Test command is `npm run test` (`vitest run`).
- Two workflows, and they do different jobs. `.github/workflows/ci.yml` runs `npm ci` + `npm run test` on every pull request and on pushes to master — added by U1, commit `11ef1ad`. `.github/workflows/deploy.yml` runs `npm ci` + `npm run build` and publishes to GitHub Pages on pushes to master and on manual dispatch. The line that used to sit here said CI only builds and never tests; that described `deploy.yml`, and it stopped being true of the repo as a whole when U1 landed.
- Whether a red check actually blocks a merge is branch protection — a repository setting, not a file, so no amount of reading the tree settles it. No pull request has been opened here yet, so it has never been watched happening. This is the outstanding half of both U1 and U2, and one pushed PR closes it.
- Vue 3 + Vite + Tailwind SPA, deployed to GitHub Pages under base `/CDN-Config-Generator/`.
- `AGENTS.md` points at further agent docs: `docs/agents/{issue-tracker,triage-labels,domain,persian-style}.md`, `docs/adr/`, `docs/solutions/`, `CONTEXT.md`.
