---
verdict: go with risks
range: 5d43b2372dede0d54fae90347707bd9fbd835e5e..21b1bd753e271b5f9f2d26c2063f865fd66be28b
kinds: web-ui
date: 2026-08-20
---

# Launch review — merging `governance-ci-four-gates` into `master` (PR #20)

**This change introduces one unmet gate, and it is that most of the change was
never reviewed.** Nothing in it can cause data loss, a security exposure or an
outage. One release-time hazard matters more than anything in the diff: ruleset
`21038975` already requires the status check `test` on `master`, and
`.github/workflows/ci.yml` — the only file that publishes that check — is
**absent from `master` today**. Merging closes that hole; reverting the merge
re-opens it and strands every future pull request on a check that never reports.
Seven standing repository conditions are named at the bottom and are outside
this verdict.

## What is going out

Judged at `21b1bd7`. One later commit, `35f9c2d`, adds a single documentation line to `CLAUDE.md` recording that ruleset `21038975` does not revert with the code — the hazard this report names under Rollback. It changes no code and no gate outcome.

Range `5d43b23..21b1bd7`, 59 commits, 40 files. The base resolved as the branch
point: no tag exists in this repository (`git tag -l` is empty), and
`git merge-base master governance-ci-four-gates` is `5d43b23`, which is also
`origin/master`'s tip.

What it contains: a pull-request CI job, three governance gates under
`src/meta/` (traceability, locale parity, Persian bidi), and the twelve fixes a
review of that work produced. Production source is almost untouched —
`src/utils/multiplier.js` (+5/−2), `vite.config.js` (+2) and four locale files
(net −14 lines) are the whole of it. Everything else is tests, `.evidence/`
records and docs.

**Standing state that ships regardless of this range**, checked separately:

- **No migrations, no database, no schema.** The repository contains no data
  store of any kind, so there is nothing authored earlier waiting to be applied.
- **Nothing merged but unreleased.** `origin/master` is `5d43b23`, and the last
  `deploy.yml` run — 2026-08-14, `headSha 5d43b23` — concluded `success`. What
  is live is what is on `master`.
- **The config the deploy reads** is `.github/workflows/deploy.yml` and
  `vite.config.js`'s `base: '/CDN-Config-Generator/'`. `deploy.yml` is unchanged
  in this range; the `base` literal is unchanged.
- **Repository ruleset `21038975` is already live** — created 2026-08-19, before
  this merge, and in force now. It is the subject of the release-time hazard
  above.

**Excluded from the range:** one uncommitted file, `.evidence/local-knowledge.md`
(+2/−1), which corrects the branch-protection note and records that vitest is
configured inside `vite.config.js`. It is documentation, it is not on PR #20,
and merging will not carry it. Also excluded: `dist/` (gitignored build output)
and `.evidence/reviews/` (gitignored by `.evidence/.gitignore:19`).

## Detected project kinds

`profile.py` found exactly one kind:

- **Browser user interface** (`web-ui`) — evidence: dependency `vue`, path
  `index.html`, path `src/App.vue`.

Facts it flagged that change the questions: `ci` (`.github/workflows`) and
`i18n` (`src/i18n`). Both are load-bearing here — this range is mostly CI, and
four of its changed files are locales.

No service, agent, job, published artefact or client build was detected, and
none of the frozen gate files was named. `references/universal.md` and
`references/web-ui.md` were read; no other gate file applies.

## Gates

### Universal

| Gate | Outcome | Whose | Evidence |
|---|---|---|---|
| U-1 suite green, and something enforces it | met | — | `npm run test` → `Test Files 9 passed (9)`, `Tests 1015 passed (1015)`, 2.76s. `.github/workflows/ci.yml:3` is `on: pull_request`, job id `test` runs `npm ci --ignore-scripts` + `npm run test` + `npm run build`. Ruleset `21038975` requires context `test` on `refs/heads/master`, `enforcement: "active"`, `bypass_actors: []`. Both halves watched: PR #20's `statusCheckRollup` reports `test` → `SUCCESS`; throwaway PR #21 was watched red at `mergeStateStatus: BLOCKED` with `mergeable: MERGEABLE` (ruling out a conflict) — `.evidence/work/2026-08-18-governance-ci-four-gates-fixes/R1.md`. |
| U-2 the change has been reviewed | **not met** | **this change** | A review ran at `4dfe00e` — 17 findings, clustered into 11 units plus 3 deferred items, all since closed. But its report is gitignored (`.evidence/.gitignore:19` — `reviews/`) so nothing in the tree can be cited, and the ~30 commits that *are* the fixes (`23b6851..21b1bd7`) were never themselves reviewed. The review also named its own largest gap explicitly: "the `maintainability` lens over the ~420 lines of new gate code, which the review did not run" — deferred, never run. |
| U-3 nothing secret in the repository or the logs | met | — | `git diff 5d43b23..HEAD` grepped for `api[_-]?key\|secret\|token\|passwd\|password\|BEGIN .*PRIVATE KEY\|ghp_\|github_pat_\|AKIA[0-9A-Z]{16}\|bearer ` → 8 hits, all Persian-style prose about Latin *tokens* in `docs/agents/persian-style.md` and `src/meta/bidi.test.js`. No `.env` file is tracked (`git ls-files | grep -i env` → empty) and `.gitignore:4-5` carries `.env` and `.env.*`. The range adds no logging at all: the diff has zero added lines matching `console.\|alert(\|throw `. |
| U-4 configuration is external, missing config fails loudly | n/a | — | Structural: the app reads no runtime configuration. `grep -rn "import.meta.env\|VITE_\|process.env" src/ vite.config.js` → zero hits. There is no process to refuse to start. The one environment-varying value is the build-time Pages base path, a deliberate literal at `vite.config.js:5`. |
| U-5 failure paths are handled | **not met** | standing | Both I/O boundaries sit in files this range does not touch (`git diff --stat 5d43b23..HEAD -- src/components/ src/App.vue` is empty). `App.vue:178-201` — `generate()` has no `try`/`catch`, so a throw from `generateLinks` never reaches `generating.value = false`. `OutputPanel.vue:69-74` — `copyAll()` swallows every clipboard failure in an empty `catch { }` and shows the user nothing. The changed code adds no new failure path: `.replace()` at `multiplier.js:85` and `:122` cannot throw on a non-string, because `routingSubdomain` is a string on every producing path (`parser.js:117,120,122`, `rows.js:40`, `generation.js:40`, `App.vue:124`) and `App.vue:192` already called `.trim()` on it before this change. |
| U-6 dependencies pinned and not obviously rotten | **not met** | standing | `package-lock.json` is committed, and this range adds **no dependencies at all** — `git diff --stat 5d43b23..HEAD -- package.json package-lock.json` is empty. `npm audit` → 6 vulnerabilities: 1 critical, 3 high, 2 moderate — `vitest`, `vite`, `postcss` (direct), `esbuild`, `nanoid`, `vite-node` (transitive). **Every one is a devDependency**; production dependencies are `vue` and `vue-i18n` only, and neither is flagged. Nothing vulnerable reaches the browser — this is build-machine and dev-server exposure. Predates the branch and is unchanged by it. |
| U-7 there is a way back | met, with a hazard | **this release** | Code rollback is clean: revert the merge on `master`, push, and `deploy.yml` rebuilds Pages (~2 min). No migration exists to reverse — the repository has no data store — and no schema/deploy-window problem is possible for a static bundle. **The hazard is not the code.** Reverting removes `.github/workflows/ci.yml` from `master` while ruleset `21038975` still requires context `test`; GitHub waits indefinitely on a context that never reports, so every subsequent pull request would read `BLOCKED`. See Rollback below for the paired command. |
| U-8 something will say when it goes wrong | **not met** | standing | No monitoring of any kind exists in this repository: no error reporting, no analytics, no uptime check — the app makes no network requests at all after load. The signal is a user reporting it, through the GitHub repository or the Telegram link in `Footer.vue`. No monitoring has ever existed here and this range does not change that. |
| U-9 behaviour at real size was considered | met | — | `generation.js:99-119` loops once per config and `await`s `setTimeout(r, 0)` each iteration, so the event loop yields — the README's "no browser freeze" claim holds structurally. The range's addition is one `String.replace(/\.+$/, '')` per built link at `multiplier.js:85` and `:122`: end-anchored, no alternation, no backtracking risk, O(1) per link. Judged against the largest shape in the suite, `roundtrip.test.js`'s 819 cases, which pass in 229ms. The real production number — configs × CDN lines a user pastes — is unbounded by the UI and unknown; stated rather than measured. |
| U-10 someone can operate it without asking you | **not met** | standing | Running it is covered: `README.md` in four languages with a live URL and a usage walkthrough. The governance change documents itself — `CLAUDE.md`, updated in this range by unit R8, states that a `master` ruleset requires the `test` check and "a red suite blocks the merge". What is missing is *what changed in this release*: no `CHANGELOG` and no release notes exist (`ls CHANGELOG* RELEASE*` → none), so the only answer is `git log`. **Breaking changes: none.** The one behaviour change — `host` now strips a trailing dot — is unreachable through the UI, because `rows.js:92` rejects a trailing-dot routing subdomain upstream; and the four deleted locale keys (`config.ports`, `output.title`, `common.clear`, `common.ready`) were rendered nowhere, confirmed by grep over `src/` and by the locale gate. |

### Browser user interface

| Gate | Outcome | Whose | Evidence |
|---|---|---|---|
| W-1 every async surface has three states | **not met** | standing | `OutputPanel.vue` renders loading (progress bar, lines 3-13), loaded (textarea, 38-47) and empty (`output.empty`, line 18) — three of four. There is **no error state**: `generate()` has no catch, so a throw renders no output and leaves the progress bar on screen. File untouched by this range. |
| W-2 a failure is recoverable without a reload | **not met** | standing | Same defect, from the user's side: on a throw, `generating` stays `true`, so the Generate button stays `:disabled` (`App.vue:61`) and the only exit is a refresh, which discards every pasted config. Clipboard failure (`OutputPanel.vue:73`) is silent — the user believes it copied. File untouched by this range. |
| W-3 keyboard and screen reader can do the job | **not met** | standing | Keyboard reach is fine — every control is a native `<button>`, `<select>` or `<input>`, and Tailwind's preflight does not strip the default focus ring. But **zero explicit focus styles** exist: `grep -cE "focus:\|focus-visible\|:focus"` returns `0` for all seven components, `App.vue` and `style.css`. And `LangSwitcher.vue:3-4` and `ThemeSwitcher.vue:3-4` put the label in a `<span>` beside the `<select>` with no `for`/`id` pairing and no `aria-label`, so a screen reader announces an unnamed control. 11 form controls, 7 `<label>` elements. No accessibility linter is configured in `package.json`. |
| W-4 survives a slow and a hostile network | n/a | — | Structural: the app makes no network requests after load. `grep -rnE "fetch\(\|XMLHttpRequest\|axios\|WebSocket\|navigator.send"` over `src/` and `index.html` returns one comment in `roundtrip.js` and no call site. There is no fetch to time out, no spinner tied to a request, and no optimistic write to reconcile. |
| W-5 the first load is not absurd | met | — | Built at both ends against the same `node_modules`, via a detached worktree at the base. Base `5d43b23`: `index-DLfuNgYp.js  170.49 kB │ gzip: 61.88 kB`, CSS `14.48 kB`. Head `21b1bd7`: `index-B9EVaLBo.js  170.12 kB │ gzip: 61.76 kB`, CSS `14.51 kB`. The entry chunk **shrank** by 0.37 kB — the four deleted keys across four locales. No new dependency entered the bundle. |
| W-6 nothing sensitive is in the client | met | — | The built bundle's only absolute URLs are the repository, the author's Telegram handle, `vuejs.org/error-reference/`, and three W3C XML namespaces. The 25 `token` matches in `dist/assets/index-B9EVaLBo.js` are all vue-i18n's message parser (`nextToken`, `EXPECTED_TOKEN`, `"tokenizer"`), inspected in context. No bundler-inlined variables can exist: there are zero `import.meta.env` reads, so vite has no prefix to embed. |
| W-7 text renders correctly in every locale it claims | met | — | `npx vitest run src/meta/` → `Test Files 3 passed (3)`, `Tests 41 passed (41)`. `locales.test.js` (18 tests) *is* the key-parity and orphan-key gate, it is green, and the ruleset makes it blocking. Direction is handled at `src/i18n/index.js:23,32` — `rtlLocales = ['fa']`, setting `dir` to `rtl` or `ltr`. `bidi.test.js` (9 tests) additionally asserts no Latin run in `fa.json` ends on a reversing neutral. The long-string layout case is in **Not checked**. |
| W-8 the browsers you claim to support were tried | **not met** | standing | Nothing states a target: no `browserslist` key in `package.json`, no `.browserslistrc`, and `README.md` names browsers only as Xray fingerprint values (`chrome, firefox, safari, edge`), not as support. The effective target is Vite 5's default (`modules` — native ESM), by omission rather than by decision. Nobody can test against an unstated target. |

**Counts, and they are three numbers rather than one:**

```
Introduced by this change:     1 unmet — most of the range was never reviewed
Load-bearing for this release: 1 unmet — reverting strands ruleset 21038975
Standing repository condition: 7 unmet — all predate the branch point
```

## Blocking

**None.** Nothing in bucket A or bucket B can cause data loss, a security
exposure, or an outage with no way back. The one release-time hazard has a
one-command remedy, named in Rollback below, and it is a governance hazard
rather than a production one — a stranded ruleset blocks future merges, it does
not take the site down.

## Accepted risks

- **U-2 — most of this range was never reviewed** *(bucket A)*. The original
  governance work was reviewed at `4dfe00e` and every one of its 17 findings was
  triaged into a unit and closed. The ~30 commits of fixes that followed were
  not reviewed, and the maintainability lens over the ~420 lines of new gate
  code was explicitly deferred and never run. Mitigating, and worth weighing:
  each of the twelve units carries its own record under
  `.evidence/work/2026-08-18-governance-ci-four-gates-fixes/` with a red-then-green
  proof, several taken by live mutation against the real gate. That is evidence
  of a different kind than a second reader, not a substitute for one. **Also
  weighing against blocking: this code is test and CI code. Its failure mode is
  a false green or a false red in CI, not a user-visible defect.**

- **U-7 — reverting this merge strands ruleset `21038975`** *(bucket B)*. Named
  in full under Rollback. It is bucket B and not bucket A because it is caused
  by pressing merge rather than by anything in the diff, and because the
  alternative on offer is not a safer release — it is never landing the CI gate
  at all.

- **A note that argues the other way, and should be on the record too:** the
  hazard's mirror image is live *right now*. Ruleset `21038975` is active and
  `ci.yml` is absent from `master` (`git ls-tree master .github/workflows/`
  shows only `deploy.yml`). A pull request opened today from a branch cut off
  current `master` would never see a `test` check report, and would block
  forever. PR #20 is `CLEAN` only because `pull_request` workflows run from the
  head branch, where `ci.yml` exists. **Merging closes an open hole; not merging
  leaves it open.**

## Standing repository condition

Every line below predates the branch point, is untouched by this range, and
merging does not make any of it live. It is outside the verdict.

- **U-5** — `generate()` (`App.vue:178`) has no `try`/`catch`; `copyAll()`
  (`OutputPanel.vue:69`) swallows clipboard failures in an empty catch.
- **U-6** — `npm audit` reports 6 vulnerabilities (1 critical, 3 high, 2
  moderate), all in devDependencies; nothing vulnerable ships to the browser.
- **U-8** — no monitoring, error reporting or uptime check has ever existed here.
- **U-10** — no `CHANGELOG` or release notes; "what changed" is answerable only
  from `git log`.
- **W-1** — no error state on the one async surface.
- **W-2** — a failed generation is a dead end that costs the user their input;
  a failed copy is silent.
- **W-3** — no explicit focus styles anywhere; the two `<select>` switchers have
  no accessible name.
- **W-8** — no stated browser support target.

## Rollback

**Not one-way, but it is two commands rather than one, and doing only the first
breaks the repository's ability to merge anything.**

1. `git revert -m 1 <merge sha> && git push origin master` — `deploy.yml` fires
   on the push and republishes Pages from the reverted tree. Roughly two
   minutes. Nothing is lost: the app holds no state, writes no storage, and the
   only artefact is a static bundle.
2. **In the same breath**, neutralise the ruleset, or `master` blocks every
   future pull request on a `test` check that no longer has a workflow to
   publish it:
   - soft — `PUT` ruleset `21038975` with `"enforcement": "disabled"`, keeping
     its definition; or
   - hard — `gh api -X DELETE repos/rahgozar94725/CDN-Config-Generator/rulesets/21038975`.

The same coupling holds for any later change that renames the `test` job or
moves `.github/workflows/ci.yml` — the ruleset must move with it. R1's record
names `.github/workflows/ci.yml:15` as load-bearing for exactly this reason. The
failure is at least in the safe direction: it blocks merges rather than letting
a red one through.

## Watch after launch

- **First, within ~3 minutes:** the `Deploy to GitHub Pages` run for the merge
  commit — `gh run list --workflow=deploy.yml --limit 1`. Bad reading: any
  conclusion other than `success`. The build step is `npm ci && npm run build`,
  the same build CI already ran green on this head, so a failure here means the
  Pages environment rather than the code.
- **Then:** load `https://rahgozar94725.github.io/CDN-Config-Generator/` and
  paste one VLESS and one VMESS config. Bad reading: a blank page or 404s on
  `/CDN-Config-Generator/assets/*` — that is the `base` path, the one thing a
  static deploy classically breaks. `dist/index.html` was checked and emits
  `src="/CDN-Config-Generator/assets/index-B9EVaLBo.js"`, so it is correct at
  build time.
- **The governance half, and it is the one nobody will think to check:** open
  the next pull request from a branch cut off the new `master` and confirm its
  `test` check reports at all. Bad reading: `mergeStateStatus: BLOCKED` with no
  check listed in `statusCheckRollup` — that is the stranded-context failure,
  and it means the ruleset and the workflow have come apart.
- **Everything else: a user will tell us.** There is no monitoring, and that is
  a choice being recorded here rather than an oversight — see U-8.

## Not checked

- **W-7, the long-string half.** Whether the layout survives strings two or
  three times longer than English needs a rendered page at a narrow viewport.
  The locale gate proves the four files carry one key set and that Persian
  Latin runs do not reverse; it proves nothing about the box holding them. Not
  reached here — no unit-level entry point exists for it, and the components
  are outside this range in any case.
- **The three `## Deferred` items across the plans**, which are open questions
  rather than gates and were not re-opened here. The one with teeth: the bidi
  gate scores three strings broken that R9 measured rendering correctly
  (`VLESS. ` among them). Its error runs in the safe direction — the gate is
  over-strict, so nothing broken ships because of it — and it costs authors
  friction. `.evidence/plans/2026-08-18-governance-ci-four-gates-fixes.md:408`.
- **A line-by-line re-review of the code.** Out of scope for this skill by
  design; it is what U-2 records as not met rather than something to improvise
  here.
