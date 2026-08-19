---
title: The four gates cannot be greened by an empty test, a missing key or a deleted file
date: 2026-08-18
status: active
branch: governance-ci-four-gates
---

# Governance gate fixes, from the 2026-08-18 review

Generated from the triage in
`.evidence/reviews/2026-08-18-4dfe00e/report.md`. That report is regenerated per
run and is not committed, so every unit below carries the finding's substance
rather than its id. The ids are kept only so the two documents can be lined up
while the report still exists.

## Problem frame

The `governance-ci-four-gates` branch added a pull-request CI job and three
governance gates. Two things are wrong. `master` has no branch protection, so
nothing the branch adds can actually stop a merge. And several of the gates can
be satisfied without the condition they check being true — a skipped test counts
as coverage, a locale key referenced in source but defined nowhere passes, an
exemption never re-checks itself against the spec.

Done, from outside the code: a pull request with a red gate cannot be merged,
and no gate can be greened by an empty test, an empty string, a dead key or a
deleted file.

## Grounding

- Files read and confirmed to exist: `src/meta/traceability.test.js`,
  `src/meta/locales.test.js`, `src/meta/bidi.test.js`,
  `src/utils/multiplier.test.js`, `src/utils/rows.test.js`,
  `.github/workflows/ci.yml`, `vite.config.js`, `CLAUDE.md`,
  `docs/agents/persian-style.md`, `src/theme/index.js`, `SPEC.md`.
- Existing patterns mirrored: the `found the tables it audits` canary in
  `src/meta/traceability.test.js` is the precedent for a gate asserting its own
  input is non-empty before asserting anything about it. Reuse that shape.
- `vite.config.js` has no `test:` block, so `src/meta/*.test.js` is collected
  only by vitest's default include — confirmed by reading the file.
- `src/theme/index.js:3` is a literal `['light', 'dark', 'system']`, so the live
  theme set is knowable exactly.
- Prior learnings consulted: none matched — `.evidence/learnings/` does not
  exist yet in this repository.

## Scope

In scope: the three gate files, the two test files carrying weak V-tags, the CI
workflow, and the two documents that describe them.

Out of scope: changing what any gate's *rule* is, as opposed to closing holes in
how it enforces the rule it already has. That distinction is what keeps this
plan a fix plan rather than a second feature.

## Assumptions

Chose to fix forward on this branch rather than open a second one, because the
findings are about the diff between `5d43b23` and `4dfe00e` and any other branch
is a different diff. Reverse by cherry-picking these commits elsewhere.

## Units

### R1 — Require the `test` check on `master`

- **Goal:** A pull request with a red gate cannot be merged.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** none in this repository — this is a repository setting
- **Authority:** granted — create one repository ruleset on `master` in this
  repository only, requiring a pull request and requiring the status check named
  `test`. Nothing else: no other branch, no other repository, no other setting.
  Granted by the repository owner on 2026-08-18.
- **Approach:** Create the ruleset described in `Authority` — target `master`,
  require a pull request before merging, require the status check named `test`
  (the job id at `.github/workflows/ci.yml:15`). Read the ruleset back after
  creating it rather than trusting the create call's exit code, and paste what
  came back into the record. If the credential available to you cannot create
  rulesets, stop and report — do not weaken the rule to something you can set.
- **Verification:** A pull request whose CI check is red shows the merge button
  disabled.
- **Acceptance criteria:**
  - Branch protection or a ruleset requires the `test` check on `master`.
  - The record contains the ruleset read back from the API after creation,
    showing `master`, the pull-request requirement and the `test` check by name.
  - The record names who set it and on what date, or names it as still open.

### R2 — Close the traceability gate's four holes

- **Goal:** The traceability gate cannot be satisfied by a test that never ran,
  a stale exemption, an unaudited section, or a stray file in `docs/adr/`.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `src/meta/traceability.test.js`
- **Approach:** Four changes in one file.
  1. `testTags` at line 46 is `/['"`]((?:V\d+[,\s]*)+):/g` over raw file text, so
     it counts `it.skip('V9: …')`, `it.todo(…)`, a commented-out test and a bare
     string as coverage. Reject a tag whose match is preceded by `.skip(`,
     `.todo(` or `.fails(` on the same line.
  2. `UNTESTED_BY_DESIGN = ['V9']` at line 24 is never validated. If §V is
     renumbered the exemption silently transfers to a different invariant; if
     the V9 row is deleted the entry becomes dead and invisible. Assert every id
     in the list still has a §V row, and assert the list's exact contents so
     widening it is a visible edit.
  3. The §B citation audit at lines 98-116 has no §T counterpart, but §T's
     `cites` column references V-ids (`SPEC.md:57` onward). Reuse
     `sectionRows(spec, 'T')` through the same assertion.
  4. `adrFiles` at line 61 comes from `readdirSync` with no canary and matches
     on `startsWith(`${number}-`)`, so a directory or a `.bak` satisfies a
     citation. Add it to the canary and filter to `/^\d{4}-.+\.md$/`.
- **Test scenarios:**
  - error: a fixture containing `it.skip('V999: …')` yields no tag
  - error: an exemption id absent from §V fails, with the id named
  - error: a §T row citing a V-id that has no row fails, with the row named
  - edge: a `0099-something/` directory does not satisfy an ADR citation
- **Verification:** Tagging an invariant with a skipped test no longer counts as
  covering it, and the failure names the invariant.
- **Acceptance criteria:**
  - Each of the four holes has a fixture that fails before its fix and passes
    after, with both runs recorded.
  - `npm run test` passes.

### R3 — Close the locale gate's three holes

- **Goal:** The locale gate catches a key used in source but defined nowhere, a
  key whose value is empty or nested, and a dead key under the exempt prefix.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `src/meta/locales.test.js`
- **Approach:** Three changes in one file.
  1. `orphans()` at line 61 only looks locale→source. The reverse —
     `$t('rows.typoError')` for a key no locale file defines — passes every gate
     and renders the raw key on screen. `quotedStrings` at line 32 is already
     computed; assert every quoted string that looks like a locale key is
     present in `locales.en`. **Derive the namespace set from `locales.en`'s own
     top-level keys** rather than hard-coding `(app|input|rows|…)`, which would
     be a new pin that rots exactly the way the `theme.` prefix pin did.
  2. Parity at lines 45 and 69 compares `Object.keys` only — top-level, and
     never values. An empty string, the English text pasted into `ru.json`, and
     a nested object all pass, and a nested value additionally throws a bare
     `TypeError` in `bidi.test.js:130`. Assert every value in every locale is a
     non-empty trimmed string; that forbids nesting outright and fixes the
     `TypeError` too. **Run this first** — if a legitimate value is currently
     nested or padded, that is a finding, not a blocker.
  3. `EXPECTED_DYNAMIC_PREFIXES = ['theme.']` at line 22 exempts every key under
     that prefix permanently, so `theme.auto` added today ships dead and passes.
     `src/theme/index.js:3` is a literal `['light', 'dark', 'system']`; read it
     and exempt exactly `themes.map(t => 'theme.' + t)`.
- **Test scenarios:**
  - error: a fixture using a `$t()` key with no locale entry fails, key named
  - error: an empty value and a nested object each fail
  - error: a `theme.auto` key present in all four locales fails as an orphan
- **Verification:** A locale key used in source but defined nowhere turns the
  suite red and the failure names the key.
- **Acceptance criteria:**
  - Each of the three holes has a fixture that fails before its fix and passes
    after, with both runs recorded.
  - The namespace set and the theme set are both derived, not hard-coded.
  - `npm run test` passes.

### R4 — Stop the bidi gate failing ordinary Persian numerals

- **Goal:** A plain Persian sentence containing an ASCII number is not reported
  as a broken Latin run.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `src/meta/bidi.test.js`
- **Approach:** `LATIN = /[A-Za-z0-9]/` at line 38 treats ASCII digits as Latin,
  so `حداکثر 253. مقدار` is reported broken as `"253. "` — verified by running
  the production helpers against that string. Conversely `عدد ۲۵۳. مقدار` with
  Persian-Indic digits is invisible to the gate entirely. Treat a digit run as
  Latin only when it is adjacent to an `[A-Za-z]` character in the same run, and
  add a numeric-only row to `WORKED_EXAMPLES` carrying its measured verdict.
  A false positive on correct Persian is worse than a miss here: it trains
  authors to reword sentences that were fine, or to switch digit sets to escape
  the gate, which `docs/agents/persian-style.md` forbids for other reasons.
- **Test scenarios:**
  - happy: `حداکثر 253. مقدار` is clean
  - edge: `بین 8-12 عدد` stays clean (it is clean today)
  - error: `پشتیبانی VLESS://` still fails, with the run named
- **Verification:** A Persian sentence whose only Latin-class characters are
  digits is not reported broken.
- **Acceptance criteria:**
  - The numeral case fails the gate before the fix and passes after, both runs
    recorded, and the `VLESS://` case still fails after.
  - `npm run test` passes.

### R5 — Anchor V14 and V15 to assertions that can actually fail

- **Goal:** Each tagged invariant has an assertion behind it that fails if that
  specific invariant regresses.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `src/utils/multiplier.test.js`, `src/utils/rows.test.js`
- **Approach:** The branch closed six previously-untested invariants by tagging
  the nearest existing test, and two of those tags do not hold.
  - **V15** ("no trailing dot in `host`; a trailing dot appears only in `sni`",
    `SPEC.md:51`) is tagged on `multiplier.test.js:256`, which asserts two `sni=`
    patterns and **nothing at all about `host`**. Add
    `expect(out[0]).not.toMatch(/host=[^&#]*\.(?=[&#]|$)/)`.
  - Separately, `multiplier.test.js:144` and `:250` both assert
    `toMatch(/host=info\.example\.com/)`, which is unterminated and matches
    `host=info.example.com.` too. Anchor them. The review named this inside F4's
    prose but omitted it from F4's fix; it is the same defect class.
  - **V14** has eight clauses and its tag at `rows.test.js:140` sits on the
    accept-only case; every reject clause is in untagged tests below it. Tags
    are comma-separated and several tests may carry the same id, so move the tag
    onto the reject tests as well.
- **Test scenarios:**
  - no red is available here — the code is correct and the tests were weak, so
    each added assertion is proved by mutation: break the behaviour it names,
    watch that assertion go red and little else, revert
- **Verification:** Removing the trailing-dot guard from the generator turns the
  V15-tagged test red.
- **Acceptance criteria:**
  - Every added or moved assertion has a recorded mutation showing it can fail,
    narrow enough that the failure is attributable.
  - `npm run test` passes with the same count as before plus the new assertions.

### R6 — Make the gates impossible to delete silently

- **Goal:** Deleting a gate file turns the suite red instead of green.
- **Depends on:** R2
- **Mode:** vertical slice
- **Files:** `src/meta/traceability.test.js`, `vite.config.js`
- **Approach:** No test asserts the three `src/meta/` files exist and there is no
  `CODEOWNERS` anywhere, so deleting `bidi.test.js` leaves the suite fully green.
  Assert that `readdirSync(join(root, 'src', 'meta'))` contains all three
  filenames. Separately add an explicit `test: { include: ['src/**/*.test.js'] }`
  to `vite.config.js`, which has no test block today.
  **Be honest about what this does not do.** The presence assertion catches one
  or two files going missing, not all three. And *descoping* is not catchable at
  all: if vitest stops collecting `src/meta/`, no assertion inside those files
  runs, so nothing in the suite can report its own absence. The explicit
  `include` is a guard against the natural next edit, not a detector.
- **Test scenarios:**
  - error: renaming `bidi.test.js` turns the suite red, naming the missing file
- **Verification:** A missing gate file is reported by name rather than passing
  silently.
- **Acceptance criteria:**
  - The presence assertion fails when a gate file is renamed away, proved by
    mutation and reverted.
  - `vite.config.js` names the include explicitly.
  - The record states plainly that descoping remains uncatchable by any test.

### R7 — Run the build on every pull request

- **Goal:** A change that breaks the Vite build cannot merge green.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `.github/workflows/ci.yml`
- **Approach:** `ci.yml` runs `npm ci` then `npm run test` and never builds;
  `deploy.yml` is the only place `npm run build` runs and it triggers on push to
  master, not on pull requests. So a broken build reports green CI, merges, and
  fails in the Pages deploy on master. Add `- run: npm run build` as a final
  step of the `test` job, reusing the install the job already did. While in the
  file, add `--ignore-scripts` to the `npm ci` step: this is the repository's
  first workflow to execute lockfile-controlled code proposed by a
  non-maintainer, the blast radius is small, and the hardening is free.
- **Test scenarios:**
  - error: a deliberate syntax error in a component fails the job at the build
    step
- **Verification:** A pull request that breaks the build turns the CI check red.
- **Acceptance criteria:**
  - The `test` job runs the build after the suite.
  - Observed on a real pull request run, or recorded as `unverified` naming what
    would settle it.

### R8 — Correct `CLAUDE.md` about how CI now gates

- **Goal:** The repository's entry-point instruction file describes the CI this
  branch actually created.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `CLAUDE.md`
- **Approach:** `CLAUDE.md` is a new file in this same diff and it is wrong
  about the diff's headline change. Line 24 says CI "runs only `npm ci` +
  `npm run build` — tests do not gate a merge", which describes `deploy.yml` and
  stopped being true of the repository when `ci.yml` landed. Line 11 describes
  the suite as "colocated `src/utils/*.test.js`", but three suites now live
  under `src/meta/`. Rewrite both: name `ci.yml`, `npm run test` on every pull
  request, and the four gates; add a `## Layout` entry for `src/meta/` saying
  what the three gates assert. Until R1 lands, say plainly that the check runs
  but does not yet block a merge.
- **Test scenarios:**
  - none — documentation with no behaviour
- **Verification:** Someone reading `CLAUDE.md` alone can tell what turns the
  suite red and whether it blocks a merge.
- **Acceptance criteria:**
  - Both statements match the tree, checked by reading both workflow files.
  - The merge-blocking claim matches R1's actual state at the time of writing.

### R9 — Measure the three unresolved bidi cases

- **Goal:** The three strings whose rendering nobody has observed are measured,
  so the style doc can state a threshold that is true.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** none — this is a measurement, not a change
- **Approach:** Load the app and run the devtools snippet in
  `docs/agents/persian-style.md` against three strings, all of which the gate
  currently scores clean: `از VLESS.` (a single trailing neutral at end of
  string), `متن VLESS.مهم است` (a single neutral with no following space), and
  the live `rows.transportError` value with its em dash. The first two decide
  whether `MIRRORS_VISIBLY = 2` is the right threshold at all; the third decides
  whether `TOKEN_NEUTRAL` is right to exclude `—`, which is Unicode bidi class
  ON and resolves like `.` and `/`. This needs a browser, so it is a person's
  job, not an agent's.
- **Test scenarios:**
  - none — the output is three measured verdicts
- **Verification:** Each of the three strings has an observed visual order
  recorded, not an inferred one.
- **Acceptance criteria:**
  - Three verdicts recorded with the string, what was rendered, and the date.

### R10 — State the measured threshold in `persian-style.md`

- **Goal:** Rule 2 and the gate agree, and the doc claims only what the gate
  delivers.
- **Depends on:** R9
- **Mode:** vertical slice
- **Files:** `docs/agents/persian-style.md`
- **Approach:** Rule 2 at line 43 states an absolute ban — a Latin run must never
  end on `://`, `.`, or other punctuation, and "End-of-string does not save it".
  The gate fails only a trailing neutral run of two or more (`MIRRORS_VISIBLY`),
  so `از VLESS.` returns clean. Line 71 then says the gate "covers rule 2's
  trailing half", which overstates it. Amend rule 2 to state the measured
  threshold, using whatever R9 actually observed — **not** the threshold the
  code currently uses, unless R9 confirms it. Also narrow line 58, which claims
  the six worked examples are the gate's fixture: that is true for five, and
  `دانلود .txt` is carried with a reason because the gate does not judge leading
  neutrals.
- **Test scenarios:**
  - none — documentation
- **Verification:** A reader of rule 2 can predict what the gate will and will
  not fail.
- **Acceptance criteria:**
  - Rule 2 states a threshold R9 measured, and the doc's coverage claim matches
    the gate's actual scope.

### R11 — Level the `rows.flowError` wording across locales *(proposal — drop in one word)*

- **Goal:** The Persian string does not carry a protocol-level distinction the
  other three locales lack.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `src/i18n/locales/fa.json`
- **Approach:** U4 reshaped `rows.flowError` by appending `در خود پروتکل` after
  `رمزنگاری VLESS` so the Latin run ends on a Persian word. The gloss is correct
  against `CONTEXT.md` and uses its glossary term, so this is not vocabulary
  drift — but `en`, `ru` and `zh` were left at the bare wording. Either add the
  clarification to the other three, or reshape the Persian without adding
  meaning, for example `یا به رمزنگاری VLESS نیاز دارد`, which also ends the run
  on a Persian word.
  **This unit is a proposal.** The review rated it confidence 50 and it is a
  judgement about translation quality in the reader's own language. Dropping it
  is a legitimate outcome and costs one word; nothing has been written to
  `ev-learn` either way.
- **Test scenarios:**
  - happy: the bidi gate stays clean on the changed value
- **Verification:** The four locales say the same thing, or the divergence is
  deliberate and recorded.
- **Acceptance criteria:**
  - Either the wording is levelled, or the unit is dropped with a reason.

### R12 — Give V15's host clause a guard in the generator

- **Goal:** `host` carries no trailing dot because the generator strips it, not
  because a validation gate two modules away happens to reject one upstream.
- **Depends on:** R5
- **Mode:** vertical slice
- **Files:** `src/utils/multiplier.js`, `src/utils/multiplier.test.js`
- **Authority:** granted — change production code in `src/utils/multiplier.js`,
  which this plan's `## Scope` did not include. One trailing-dot strip on `host`
  in each of the two builders, at `:82` and `:119`. Nothing else: no other file,
  no other behaviour, no change to what any gate's rule is. Granted by the
  repository owner on 2026-08-20, after R5 surfaced the hole and put the three
  options to them.
- **Approach:** R5 found that `buildQueryLink` (`multiplier.js:82`) and the vmess
  builder (`:119`) both write `p.host = config.routingSubdomain` verbatim, so
  V15's host clause holds only because `rows.js:92` returns
  `INVALID_TRAILING_DOT` and blocks generation for that row. The generator makes
  the opposing argument about itself sixty lines below, at `multiplier.js:143-146`:
  *"The validation gate rejects a trailing dot in the CDN subdomain field, but a
  pure function should not depend on a UI gate for correctness"* — and acts on it
  for `extractRootDomain` while leaving `p.host` unguarded. Apply the same
  argument to `p.host`. Mirror whatever stripping idiom `extractRootDomain`
  already uses rather than inventing a second one.
- **Test scenarios:**
  - happy: a routing subdomain with a trailing dot produces a link whose `host`
    has none — and the assertion the plan originally wrote for R5,
    `expect(out[0]).not.toMatch(/host=[^&#]*\.(?=[&#]|$)/)`, can now sit on
    `multiplier.test.js:256`, the line R5 could not use
  - error: removing either strip turns that assertion red, proved by mutation
  - edge: `sni` still keeps its trailing dot under random SNI — the strip must
    not reach it, since V15 says the dot appears there and only there
- **Verification:** The V15 assertion the plan wrote for R5 passes at
  `multiplier.test.js:256` against unmutated code, and goes red when either
  strip is removed.
- **Acceptance criteria:**
  - Both builders strip a trailing dot from `host`, each proved by a mutation
    that turns the V15 assertion red and little else.
  - The random-SNI trailing dot in `sni` is unaffected, shown by a passing
    assertion rather than by argument.
  - R5's record and status are updated: its `outstanding` is settled by this
    unit, and it moves from `needs-decision` to `done`.
  - `npm run test` passes.

## Deferred

- Whether "at least one tagged test" is a strong enough rule for the
  traceability gate at all — R5 fixes two instances, not the rule. Settled by
  seeing whether new tags land on weak tests again after R5.
- Reading vitest's JSON reporter instead of file text in the traceability gate,
  so a tag must belong to a test that ran. Settled by whether R2's regex fix
  proves insufficient in practice.
- The `maintainability` lens over the ~420 lines of new gate code, which the
  review did not run and named as its own largest gap. Settled by running it.
- Whether the locale orphan rule should extend to `README.*`. Settled by seeing
  whether the READMEs drift again after the next feature lands.
- Whether each §B defect should require a regression test rather than a
  resolvable citation. Settled by checking whether B1-B11 are individually
  testable; several are UI-state defects with no unit-level entry point.

- Whether the bidi gate should stop counting whitespace and repeated
  characters toward MIRRORS_VISIBLY. R9 measured three strings the gate calls
  broken that render correctly, all of them period-plus-space or a repeated
  character. Every measurement fits one rule: a trailing neutral run mirrors
  visibly only when, whitespace removed, two or more characters remain and
  they are not all the same. Deferred rather than fixed because the error is
  in the safe direction — the gate is over-strict, so nothing broken ships
  because of it — and because it needs a Files entry no unit has. Settled by
  the repository owner deciding whether author friction is worth a unit.

## Order

R1, R7, R8, R2 → R6, R3, R4, R5 → R12, R9 → R10, R11

Depth 2. Only two real chains exist: R6 needs R2 because both edit
`src/meta/traceability.test.js`, and R10 needs R9 because the doc must state a
threshold somebody measured. Everything else is independent of everything else.
This notation is descriptive — units run one at a time — but it says the eleven
units are two deep, and it shows where a second person could pick up work by
hand without colliding.

Amended 2026-08-20: R12 was added after R5 ran and depends on it, so there
are now three chains rather than two. The depth is still 2.


## Log

- 2026-08-18 plan written from the triage in
  `.evidence/reviews/2026-08-18-4dfe00e/report.md`. Seventeen findings clustered
  into eleven units; three items sent to `## Deferred` rather than executed; one
  unit (R11) carried as a droppable proposal. Every cited path confirmed to
  exist and every cited line number read, on branch `governance-ci-four-gates`
  at `4dfe00e`.
- 2026-08-19 run-mode: checkpoint (one unit) — user typed neither `auto` nor `budget`
- 2026-08-19 R1 unverified: ruleset created, active and read back, but no red
  check has been watched blocking a merge — 1c06d36 — 3/3 evidenced —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R1.md
- 2026-08-19 verified-through: R1 @ 1c06d36 — record read, ruleset 21038975
  re-read from the API by the orchestrator, criteria evidenced, suite green
  (997 tests)
- 2026-08-19 run-mode: checkpoint (one unit, R7) — user typed neither `auto` nor
  `budget`
- 2026-08-19 R7 done — f3ab74b — 2/2 evidenced —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R7.md
- 2026-08-19 R1 done (was `unverified`, a status this workflow does not have) —
  2f33953 — 3/3 evidenced plus the `Verification` line, which R7's throwaway
  pull request #21 settled: `mergeStateStatus: BLOCKED` with
  `mergeable: MERGEABLE` while the required `test` check was red. Capture and
  cleanup in R7's record; R1's record updated in place.
- 2026-08-19 verified-through: R7 @ f3ab74b — records read, criteria evidenced,
  scaffolding removal confirmed, suite green (997 tests)
- 2026-08-19 run-mode: budget(4 units, R8→R3) — user typed `budget 4 units`
- 2026-08-19 R8 done — c8c0ae3 — 2/2 evidenced —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R8.md
- 2026-08-19 R2 done — 8f7f762 — 2/2 evidenced, all four holes red-before and
  green-after with quoted output —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R2.md
- 2026-08-19 R6 done — 8e2b3ed — 3/3 evidenced, red-then-green mutation proof
  quoted — .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R6.md
  Committed late: the run that produced this unit stopped before committing it
  and reported it as never started. The record and the two files it names were
  already on disk; the suite was not re-run at commit time from the machine that
  committed it, so the green run quoted is the unit's own, taken when the work
  was done and with nothing landing between.
- 2026-08-19 verified-through: R6 @ 8e2b3ed — records read, criteria evidenced
- 2026-08-19 run-mode: budget(4 units, R3→R9) — user typed `budget 4 units`
- 2026-08-19 R3 done — 6d6bdaf — 4/4 evidenced (three plan criteria plus
  Approach item 2's finding clause) —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R3.md
  Two agents ran this unit. The first implemented it and stalled before writing
  any evidence, leaving the code on disk with an `in-progress` record; the
  second inherited that implementation rather than rewriting it and re-took the
  proof by mutation — each hole made real in the live tree, the real gate
  observed going red naming the offending key, then reverted. The record says so
  under `## Interruption`, so the quoted reds are not mistaken for the original
  pre-fix runs. Orchestrator restored `src/i18n/locales/en.json` mid-run after a
  scaffolding revert left it CRLF-terminated; content was byte-identical.
- 2026-08-19 R4 done — 8294341 — 3/3 evidenced, red-then-green quoted verbatim
  plus a live-gate mutation proof against `fa.json` —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R4.md
  The fix filters finished runs rather than narrowing the character class, so
  `IP 253. ` and `VLESS://` are still caught while `حداکثر 253. مقدار` is clean.
  R3's `controlsIn` TypeError was taken here rather than left upstream: the
  canary now names non-string keys, deliberately without filtering the bad value
  out of `entries`. Record's `commit:` corrected in 11de83f — it cited f367712,
  the pre-amend sha, which is unreachable from any branch.
- 2026-08-19 R5 needs-decision: V15's host clause has no production guard —
  f70dfe9 — 2/2 evidenced, nine mutations recorded and reverted —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R5.md
  The unit's own criteria are met: V14's tag now sits on all seven reject tests,
  each proved red by removing its own guard; V15 has an anchored `host`
  assertion proved by mutation; both unterminated `host=info\.example\.com`
  matches are anchored. What it could not do is put the V15 assertion at the
  line the plan named — `multiplier.js:82` and `:119` write
  `p.host = config.routingSubdomain` verbatim, so the plan's literal assertion
  is red against unmutated code. V15 holds today only because `rows.js:92`
  rejects a trailing dot upstream. `multiplier.js:143-146` already argues in its
  own comment that a pure function should not depend on that gate, and applies
  the argument to `extractRootDomain` but not to `p.host`. Deciding between a
  one-line strip in both builders and amending V15's §V row is a scope crossing
  either way — `src/utils/multiplier.js` and `SPEC.md` are both outside this
  unit's Files. Put to the user.
- 2026-08-20 R9 done — 7893dc2 — 1/1 evidenced, three verdicts measured
  numerically in Chromium —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R9.md
  The plan assigned this unit to a person for want of a browser. One was
  available this session, so the measurement was taken rather than deferred;
  `Files` stayed none and no gate or production file was touched. All three
  strings render correctly and the gate agrees on all three. Two subagents
  stalled on it first — the second after measuring and before writing anything
  down — so it was run inline and re-measured from scratch rather than read off
  the screenshot the stalled run left behind. Instrument and screenshot are
  committed beside the record so the numbers can be reproduced. Two answers for
  R10: `TOKEN_NEUTRAL` is right to exclude the em dash, measured; and
  `MIRRORS_VISIBLY = 2` is the right idea applied to the wrong count — the gate
  scores `VLESS. ` broken and it renders correctly. That last one is a gate
  defect neither R9 nor R10 is scoped to fix, so it went to `## Deferred`.
- 2026-08-20 verified-through: R9 @ 7893dc2 — records read, criteria evidenced,
  suite green (1010 tests), tree clean, both scratch servers stopped and
  confirmed released
- 2026-08-20 budget spent: budget(4 units, R3→R9) is complete. R3, R4 and R9 are
  `done`; R5 is `needs-decision`, and the decision was taken — the owner chose
  the guard, which is now unit R12 carrying the granted authority. Remaining:
  R12, R10, R11.
- 2026-08-20 run-mode: continuous(R12 → R10 → R11) — user typed `auto`
- 2026-08-20 R12 done — c41fdb8 — 4/4 evidenced —
  .evidence/work/2026-08-18-governance-ci-four-gates-fixes/R12.md
  Two agents ran this unit. The first died mid-run on an unstable connection,
  having already written the `in-progress` marker and both file changes but no
  evidence of any kind; the orchestrator established that from disk — marker
  present with an empty body, both files modified, focused suite already green
  at 32 — and briefed the second agent to inherit the implementation rather than
  rewrite it and to re-take the proof from scratch. Every red quoted in the
  record is a mutation taken in the second run, and the record says so under
  `## Interruption`. Both strips proved load-bearing and attributable: each
  mutation turned exactly one test red, 1 failed / 31 passed, and neither
  builder's assertion caught the other's mutation. One correction to the plan:
  the `Verification` line's assertion is a query-string regex, so it goes red
  under the `buildQueryLink` mutation only — a vmess link is base64 and needs
  the separate vmess test to cover the second strip. Recorded rather than
  papered over. Hazard worth carrying: `git checkout --` reverts to HEAD, not to
  an inherited uncommitted state, and silently dropped both strips mid-run; the
  state was reconstructed and the diff confirmed identical.
- 2026-08-20 R5 done (was `needs-decision`) — f70dfe9 — settled by R12, which
  carried the owner's granted authority for the guard. R5's evidence, mutation
  table and counts are untouched; only its status, `outstanding` and a
  `**Decided:**` bullet changed.
- 2026-08-20 verified-through: R12 @ c41fdb8 — records read, 4/4 criteria
  evidenced, R5's status change confirmed on disk, suite green (1011 tests),
  tree clean
