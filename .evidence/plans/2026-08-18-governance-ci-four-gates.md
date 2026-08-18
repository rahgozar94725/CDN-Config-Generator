---
title: A merge cannot go green while the traceability chain, the locale set or the Persian bidi rules have rotted
date: 2026-08-18
status: active
---

# Governance CI: one job, four gates

## Problem frame

CI runs `npm ci` and `npm run build` and nothing else, so a red suite reaches
production and the repository's distinctive asset — the V-invariant / B-defect /
ADR chain — can rot silently. It already has: six invariants carry no test
tagged with their ID, four locale keys are referenced nowhere, and one Persian
string violates a rule its own style doc states as measured fact. Done means a
pull request cannot merge while any of those four conditions is true, and the
conditions that are true today have been fixed rather than grandfathered.

## Grounding

- Files read: `.github/workflows/deploy.yml`, `package.json`, `vite.config.js`,
  `SPEC.md`, `AGENTS.md`, `docs/agents/persian-style.md`,
  `src/i18n/locales/{en,fa,ru,zh}.json`, `src/i18n/index.js`,
  `src/components/ThemeSwitcher.vue`, `src/components/OutputPanel.vue`,
  `src/utils/generation.test.js`, `src/utils/dedup.test.js`,
  `src/utils/rows.test.js`, `docs/ideation/2026-08-14-open-ideation.html`
- Existing patterns mirrored:
  - `src/utils/generation.test.js:59` names a test `V6: false when an active
    mode has no ports` — the `V<n>: ` prefix is the existing traceability
    convention, and it is what the U2 gate parses.
  - `src/utils/roundtrip.js` is the precedent for a test-support module that is
    not a runtime util: pure JS in `src/utils/`, imported only by its own test.
  - `src/utils/rows.js:4` cites `ADR-0004` in a comment — the citation form the
    U2 resolver matches.
- Thin local grounding: nothing in this repository parses Markdown, reads a
  file from disk inside a test, or asserts anything about `src/i18n/locales/`.
  All three are new here.
- Adjacent work: `i18n/persian-translation-pass` (2 commits) is stale — its
  `src/i18n/locales/fa.json` is *behind* master by 15 lines, and its
  `docs/agents/persian-style.md` is already on master. It collides with U4 only
  if someone merges it; it would reintroduce the pre-fix Persian strings.
  `chore/ignore-tooling-dirs` touches `.gitignore` only. No collision.
- Prior learnings consulted: none matched — `.evidence/learnings` does not
  exist yet. The repository's own equivalent, `docs/solutions/`, holds one
  entry (`logic-errors/vmess-base64-percent-encoding-mismatch.md`), unrelated.

## Scope

In scope:
- A pull-request-triggered CI job that runs the test suite.
- A traceability gate over `SPEC.md` §V and §B, plus ADR citation resolution.
- A locale gate: key-set parity across four files, and no orphan keys.
- A bidi gate over `fa.json` for the two mechanically decidable Persian rules.
- The fixes each gate needs in order to pass on master.

Out of scope:
- Adding `npm run test` to `deploy.yml`. Deploy runs after merge on `master`;
  gating it stops a bad artifact but not a bad merge, and the merge is where the
  decision is made. `deploy.yml` stays a deploy workflow.
- Prose-content checks — e.g. ADR 0002 still describing a stale README claim
  that `d018f10` fixed. Detecting that requires reading what the ADR means, not
  whether its target resolves. Real problem, different mechanism.
- Bidi rule 1 (Latin-run contiguity). See `## Deferred`.
- A test-per-rejected-ADR-option suite — the ideation run's own verifier
  rejected it as largely a rename of existing `rows.test.js` tests.

## Assumptions

- Chose a new `.github/workflows/ci.yml` on `pull_request` + `push` over adding
  a step to `deploy.yml`, because a red suite must block the merge and
  `deploy.yml` only fires post-merge on `master`. Reverse by folding the job
  into `deploy.yml` if branch protection is never enabled.
- Chose vitest tests over standalone node scripts for all four gates, because
  vitest's default environment is node — `fs` and `path` work — so CI gains one
  step rather than four, and `npm run test` reproduces CI locally. Reverse by
  extracting to `scripts/` if the gates ever need to run without dev deps.
- Chose to fix what each gate finds inside that gate's own unit, over landing
  the gates with a grandfathered baseline. A baseline file is a place for
  violations to accumulate unread. Reverse only for V9 (see U2).
- Chose `.github/workflows/ci.yml` to run `npm ci` then `npm run test` only —
  not `npm run build`. `deploy.yml` already builds on `master`. Reverse if a
  build-only breakage ever reaches master through a green PR.

## Units

### U1 — Gate the merge on a green test suite

- **Goal:** A pull request whose vitest run fails reports a failed check.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `.github/workflows/ci.yml (new)`
- **Approach:** A second workflow, not a step in `deploy.yml`, so the deploy
  path keeps its `pages` concurrency group and permissions untouched. Mirror
  `deploy.yml`'s runner setup exactly — `actions/checkout@v4`,
  `actions/setup-node@v4` with `node-version: 22` and `cache: npm`, the
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env — then `npm ci` and `npm run test`.
  Triggers: `pull_request` and `push` on `master`. Permissions `contents: read`
  only; this job publishes nothing.
- **Test scenarios:**
  - happy: the suite as it stands (973 tests, 6 files, ~2.5s) runs to green on
    a pull request and the check passes.
  - edge: a push directly to `master` runs the same job, so a bypassed PR is
    still measured.
  - error: a deliberately failing assertion in any `src/utils/*.test.js` turns
    the check red and names the failing test file.
- **Verification:** Opening a pull request produces a check whose log ends in
  vitest's pass summary; the same pull request with a broken test shows the
  check failed.
- **Acceptance criteria:**
  - `ci.yml` runs on `pull_request` and on `push` to `master`.
  - `deploy.yml` is unchanged.
  - The job fails when and only when `npm run test` fails.

### U2 — Fail the build when an invariant, defect or ADR citation loses its anchor

- **Goal:** Every `SPEC.md` §V invariant has at least one test whose name
  carries its ID, every §B defect cites something that resolves, and every
  `ADR-000N` mentioned in `src/` or `SPEC.md` names a file that exists.
- **Depends on:** U1
- **Mode:** vertical slice
- **Files:** *(amended 2026-08-18 — see Log)*
  - `src/meta/traceability.test.js (new)` — the gate itself.
  - `SPEC.md` — only if a §V or §B row is malformed enough to block the gate.
  - `src/utils/**/*.test.js` (derived) — whichever tests anchor the §V ids the
    gate reports red on its first run. The plan predicted
    `V12, V14, V15, V16, V17`; the gate's measured red set is the authority,
    because the prediction is an estimate and the measurement is not.
    Permitted: prefixing the `V<n>:` tag onto an existing `it(...)` name.
    Forbidden: touching an assertion, adding or removing a test, or editing any
    non-test file under `src/`.
- **Approach:** Read `SPEC.md` from disk, slice §V and §B on their `## §`
  headings, pull the leading `| V<n> |` / `| B<n> |` cell from each row. Collect
  test names by reading every `src/**/*.test.js` as text and matching the
  `V<n>: ` prefix already in use — not by running them, so the gate stays a
  cheap string check with no import cycle. Resolve `ADR-\d{4}` citations against
  `docs/adr/` filenames. The gate is red on master today for
  `V9, V12, V14, V15, V16, V17`; four of those have tests that SPEC's own check
  column already names, so tag them. V9 (theme persisted to localStorage, `dark`
  class on `<html>`) has no test at all and no DOM test harness in the repo —
  carry it as a single named exemption constant in the gate file with the reason
  inline, so the exemption is greppable and one line to delete.
- **Test scenarios:**
  - happy: every V-id except the named exemption resolves to ≥1 tagged test;
    every B-id's `V`/`ADR` citation resolves; the gate passes.
  - edge: a V-id tagged in a test that no longer appears in SPEC §V fails the
    gate too — a deleted invariant leaves a dangling tag.
  - error: adding `| V20 | ... |` to SPEC §V with no `V20:` test anywhere fails
    with a message naming V20.
- **Verification:** Adding a row to SPEC §V without a matching test turns the
  suite red and the failure message names the untested invariant ID.
- **Acceptance criteria:**
  - Untested invariant, unresolvable B citation, and missing ADR file each fail
    with the offending ID in the message.
  - `V12, V14, V15, V16, V17` are tagged onto their existing tests without
    changing what those tests assert.
  - V9's exemption is one named constant carrying its reason.

### U3 — Fail the build on a locale key set that has drifted

- **Goal:** The four locale files hold identical key sets, and no key is
  unreferenced by `src/`.
- **Depends on:** U1
- **Mode:** vertical slice
- **Files:** *(amended 2026-08-18 — see Log)*
  - `src/meta/locales.test.js (new)` — the gate itself.
  - `src/i18n/locales/{en,fa,ru,zh}.json` (derived) — whichever keys the gate
    reports as orphaned or as missing from a file on its first run. The plan
    predicts the orphan set `config.ports`, `output.title`, `common.clear`,
    `common.ready` and a 57 → 53 key count; the gate's measured set is the
    authority, because the prediction is an estimate and the measurement is not.
    Permitted: deleting a key the gate reports orphaned from all four files, and
    adding a key the gate reports missing so the four files agree.
    Forbidden: changing any *value*, editing a `src/` file to create or remove a
    `$t(...)` call site, or exempting a key instead of deleting it.
- **Approach:** The files are flat maps of dotted string keys, so parity is a
  sorted key-array comparison — currently 57 keys each, so this half ships
  green as a ratchet. The orphan check is the delicate half:
  `ThemeSwitcher.vue:9` calls `$t('theme.' + t)`, so a literal-substring scan
  reports `theme.light/dark/system` as unused. Treat any key whose dotted prefix
  appears in a string concatenation or template literal in `src/` as live, and
  assert the prefix set is small enough to eyeball. Genuinely orphaned today:
  `config.ports`, `output.title`, `common.clear`, `common.ready` — delete them
  from all four files as part of this unit.
- **Test scenarios:**
  - happy: all four files agree on 53 keys after the four deletions and the
    gate passes.
  - edge: `theme.light`, `theme.dark`, `theme.system` are reported live via the
    `theme.` prefix, not flagged as orphans.
  - error: adding a key to `en.json` alone fails naming the key and the three
    files missing it; adding an unreferenced key to all four fails as an orphan.
- **Verification:** A new string added to `en.json` only, or added everywhere
  but never rendered, turns the suite red and names the key.
- **Acceptance criteria:**
  - Parity failure names both the key and the files missing it.
  - Dynamically composed keys are not reported as orphans.
  - The four orphan keys are gone from all four files.

### U4 — Turn the two measurable Persian bidi rules into assertions

- **Goal:** A Persian string whose Latin run ends on punctuation, or that hides
  a bidi control character, fails the suite.
- **Depends on:** U1
- **Mode:** vertical slice
- **Files:** *(amended 2026-08-18 — see Log)*
  - `src/meta/bidi.test.js (new)` — the gate itself.
  - `docs/agents/persian-style.md` — the note that the rule is now enforced.
  - `src/i18n/locales/fa.json` (derived) — whichever values the gate reports
    red on its first run. The plan predicts exactly one, `rows.flowError`; the
    gate's measured set is the authority, because the prediction is an estimate
    and the measurement is not.
    Permitted: reshaping a reported Persian sentence so its Latin run is not
    final, per the style doc's instruction to reshape rather than insert marks.
    Forbidden: inserting a bidi control character, exempting a key, weakening an
    assertion to accommodate a string, or editing `en.json`, `ru.json` or
    `zh.json`.
- **Approach:** Two assertions over `fa.json` values. First: no
  `U+200E`, `U+200F`, `U+2066`–`U+2069`, `U+202A`–`U+202E` — the style doc bans
  them by name as unreviewable in diffs. Green today. Second: every maximal
  Latin run must end on `[A-Za-z0-9]`. The worked examples in
  `docs/agents/persian-style.md` become the gate's own fixture — the doc states
  `دانلود .txt` broken and `دانلود فایل txt` ok, so the gate is testable against
  cases whose correct verdict is already measured and recorded. `rows.flowError`
  fails today (`…یا به رمزنگاری VLESS. هیچ تنظیم…` — the sentence period trails
  a Latin run); reshape the sentence so the Latin token is not final, per the
  doc's instruction to reshape rather than insert marks. Note in the style doc
  that the rule is now enforced, so the devtools snippet becomes the tool for
  the *undecidable* rule rather than for both.
- **Test scenarios:**
  - happy: every `fa.json` value passes both assertions after `rows.flowError`
    is reshaped.
  - edge: `input.cdnList.label` (`لیست IP/دامین CDN`) passes — the doc measures
    it ok, and its interior `/` must not be read as a trailing punctuation mark.
  - error: a string ending `…VLESS://` fails naming the key and the offending
    run; a string carrying `U+200E` fails naming the code point.
- **Verification:** Appending a Persian string that ends on `://` to `fa.json`
  turns the suite red and names both the key and the run that broke the rule.
- **Acceptance criteria:**
  - Both assertions fail with the key name and the specific offending substring.
  - `input.cdnList.label` and the doc's four "ok" worked examples pass.
  - `rows.flowError` is reshaped, not exempted.

## Deferred

- Bidi rule 1, "Latin runs must be contiguous", is not decidable as written —
  `docs/agents/persian-style.md` measures `لیست IP/دامین CDN` as **ok**, and
  that string has two Latin runs split by a Persian word, which is exactly what
  a naive contiguity check forbids. The rule's real content appears to be about
  `://`-bearing tokens specifically, but the doc does not say so. Settled by
  running the doc's own devtools measurement over a set of deliberately split
  strings — with and without `://`, with and without an interior slash — and
  seeing which ones actually reverse.
- Whether the U2 gate should also require each §B defect to have a *regression*
  test rather than just a resolvable citation. Settled by checking whether the
  B1–B11 fixes are individually testable at all; several were UI-state defects
  with no unit-level entry point. The gate ships with citation resolution only.
- Whether the U3 orphan rule should extend to `README.*` — a locale key is not
  the only four-way-duplicated string in the repository. Settled by seeing
  whether the READMEs drift again after the next feature lands.
- Whether branch protection is actually on for `master`. The workflow is
  necessary either way, but without protection U1 gates nothing. Settled by
  reading the repository settings, which requires access this session does not
  have.

## Order

U1 → (U2, U3, U4 in parallel)

U1 first because the other three are worth nothing until something runs them in
CI, and it is the only unit that can be verified without writing a gate. U2–U4
share no files: U2 touches `SPEC.md` and `src/utils/*.test.js`, U3 touches
`src/i18n/locales/`, U4 touches `fa.json` and the style doc. U3 and U4 both
write `fa.json` — U3 deletes whole keys, U4 rewrites one value — so if they run
concurrently, land U3 first.

## Log

- 2026-08-18 plan written — grounded at head 5d43b23 on master, suite green
  (973 tests, 6 files).
- 2026-08-18 U1 unverified — `.github/workflows/ci.yml` runs the suite on
  `pull_request` and on `push` to master; commit `11ef1ad`, record
  `.evidence/work/U1.md`. Run branch is `governance-ci-four-gates`. Ran inline
  rather than in a dispatched subagent (the subagent stalled with no progress);
  U2–U4 are unaffected. The pull-request half of U1's Verification is pending a
  push, which was left to the user; status corrected from `done` to
  `unverified` on 2026-08-18 for that reason.
- 2026-08-18 U2 unverified — `src/meta/traceability.test.js` gates §V tags, §B
  citations and ADR resolution; commit `3a5087e`, record `.evidence/work/U2.md`.
  Ran in a dispatched subagent. Outstanding: the record's own closing claim is
  that `.github/workflows/ci.yml:24` runs `npm run test`, "so the gate fails the
  PR build". The gate was observed going red locally, but no pull request has
  ever been opened on this branch, so the half of that sentence after the comma
  is inherited from U1 and was never watched happening. One pushed pull request
  settles U1 and U2 together.
- 2026-08-18 plan amended — U2's `Files` was a literal five-file list for a unit
  that is a sweep: the tags land on whichever tests the gate reports red, which
  cannot be known until the gate runs. The measured red set was
  `V11, V12, V14, V15, V16, V17, V18` against a predicted
  `V9, V12, V14, V15, V16, V17`, so `src/utils/parser.test.js` was tagged for
  V11 outside the declared list. Reviewed: every hunk in that file is a one-line
  `it('…')` name change with no assertion touched, which is the mechanical edit
  the unit was for. `Files` is therefore amended to a bounded derived entry
  covering `src/utils/**/*.test.js` with that edit permitted and assertion
  changes forbidden, rather than the parser edit being reverted. The scope
  deviation logged against U2 is closed by this amendment.
  U3 and U4 predict violation sets the same way and should be amended to the
  same shape before they run.
- 2026-08-18 plan amended — U3's and U4's `Files` rewritten to the bounded
  derived shape U2 received, before either unit runs. U3's predicted orphan set
  (`config.ports`, `output.title`, `common.clear`, `common.ready`) and U4's
  predicted single violation (`rows.flowError`) are now recorded as estimates
  the gate's measurement overrides, with the permitted edit named and value
  changes, exemptions and assertion weakening forbidden.
- 2026-08-18 pull request opened — `#20` on branch `governance-ci-four-gates`,
  base `master`. This is the observation U1 and U2 are both waiting on: neither
  can move off `unverified` until a pull-request CI run is watched.
- 2026-08-18 first pull-request CI run observed — check `test` SUCCESS on
  `#20` (run `32137646932`). That settles the *green* half of U1's Verification:
  a pull request does produce a check that runs the suite. The red half — "the
  same pull request with a broken test shows the check failed" — is still
  unobserved, and needs a deliberately broken commit pushed and reverted. U1 and
  U2 therefore stay `unverified`, with a narrower outstanding item than before.
  Not repaired from inside U3: fixing a previous unit inside a later one hides
  two states at once.
- 2026-08-18 U3 done — `src/meta/locales.test.js` gates key-set parity across
  the four locale files and flags keys nothing renders; the four orphans
  (`config.ports`, `output.title`, `common.clear`, `common.ready`) are deleted,
  57 keys to 53. Commit `<sha>`, record `.evidence/work/U3.md`. Suite 8 files /
  989 tests green, build green. Ran inline rather than in a dispatched subagent,
  per a standing instruction in this session not to spawn agents unasked; U4 is
  unaffected. Scope as declared — the measured orphan set matched the plan's
  prediction exactly, so the derived entry was never drawn on.
