---
title: The locale gate's composed-prefix scan matches any identifier ending in `t`
date: 2026-08-20
status: done
branch: governance-ci-four-gates
---

# Fix `dynamicPrefixes` in the locale gate

One unit. The gate is green today and this is a latent defect, not a firing
one — which is the reason to fix it now rather than after it goes off in a
review round that has nothing to do with i18n.

> **On the frontmatter `status: ready`.** It is not one of the template's five
> values (`draft | active | done | incomplete | abandoned`), and `ev-work`
> before v0.16.0 matched an allow-list of `active | draft`, so it would have
> skipped this file in silence and reported *"no plan exists"*. That was a bug
> in the executor, not in this plan, and it is fixed. The word is left here on
> purpose as the live test of that fix: `ev-work` should now pick this plan up
> and print one line saying `ready` is outside the vocabulary. Once you have
> seen it do that, change this to `draft`.

## Problem frame

`dynamicPrefixes` (`src/meta/locales.test.js:35-38`) composes the set of
runtime-built key prefixes by scanning source text for `t('prefix' + x)` and
``t(`prefix${x}`)``. Its pattern is

```
/\$?t\(\s*['"`]([\w.]*)['"`]\s*\+/g
```

and `t\(` has no boundary before it, so *any* identifier ending in `t` followed by
`(` matches: `format(`, `split(`, `assert(`, `parseInt(`, `expect(`, `count(`.
The capture `[\w.]*` additionally accepts an empty prefix.

Done, from outside the code: the gate's prefix set is derived from real `t` /
`$t` calls only. Adding `format('x' + y)` to a component neither turns the gate
red nor silently whitelists an undefined locale key — and the live scan still
returns exactly `['theme.']`, so nothing about today's green changes.

## Grounding

Measured on this tree at `ac9031b`, not assumed:

- `src/meta/locales.test.js` — 229 lines, confirmed. The helper is at 35-38;
  the tripwire assertion that consumes it is
  `it('the set of runtime-composed key prefixes is the one this gate composes
  keys for')` at ~line 174, asserting `.toEqual(['theme.'])`.
- The live scan covers **18** call-site files (`src/`, minus
  `src/i18n/locales/`, minus `*.test.js`) and yields exactly one match:
  `ThemeSwitcher.vue` → `theme.`. Confirmed by re-running the gate's own walk +
  regex outside vitest. `src/components/ThemeSwitcher.vue:9` is that call site:
  `{{ $t('theme.' + t) }}`.
- The phantom, on synthetic input: of eight calls fed to the current pattern,
  the six ordinary ones all match and all produce a prefix —
  `format('x' + y)` → `"x"`, `split('.' + sep)` → `"."`,
  `assert('' + v)` → `""`, `parseInt('' + n)` → `""`,
  `expect('a.b' + c)` → `"a.b"`, `count('' + q)` → `""`.
- The candidate fix — a `(?<![\w$])` lookbehind before `\$?t\(`, on both the
  concatenation and the template branch — rejects all six, still accepts
  `t(`, `$t(`, `this.$t(`, `i18n.t(`, and returns exactly `["theme."]` on the
  live tree. So the change is provably behaviour-preserving on today's source.
- Lookbehind needs Node 16+. CI pins `node-version: 22`
  (`.github/workflows/ci.yml:21`, and `deploy.yml:27`); local is v22.23.2.
- In-repo pattern to mirror: this same file already tests its helpers directly
  against fixture strings — `themeNamesIn("const themes = ['light', …]\n")` and
  `unknownKeys(['rows.', 'rows.js'], …)` near lines 200-227. New fixtures go in
  the same shape, in the same file. `src/meta/traceability.test.js:46` is the
  second precedent: it already guards a text-scan regex against a false positive
  (`.skip(` / `.todo(` / `.fails(`) with an inline comment saying why.
- Prior learnings: `.evidence/learnings/` does not exist — empty store, normal.
- Adjacent work: two branches only, `master` and this one; nothing else in
  flight, nothing else touching `src/meta/`. Working tree carries one unstaged
  edit, `.evidence/local-knowledge.md`, unrelated to this unit.

## Why it matters while it is green

Two distinct failure directions, both latent:

1. **False red.** Someone adds `format('x' + y)` to a `.vue` or `.js` file
   under `src/`. `prefixes` becomes `['theme.', 'x']`, the tripwire assertion
   fails, and the message tells them to "compose its live key set the way
   theme. is" for a call that has nothing to do with i18n. Loud, misleading,
   and blocks a merge.
2. **Silent hole.** `prefixes` is passed to `unknownKeys(...)` as an exclusion
   list (`!prefixes.includes(text)`). A phantom prefix that happens to equal a
   genuinely undefined key — `expect('rows.typoError' + n)` in a call-site file
   — removes that key from the undefined-key report. Narrow, requires an exact
   collision, but it is the gate losing teeth rather than gaining a false
   alarm.

## Scope

In scope: `dynamicPrefixes` and its fixtures, in one file.

Out of scope, stated so it is not rediscovered:

- **Dependencies.** The six npm advisories need `--force` and a vite/vitest
  major bump. Accepted risk, owned by `ev-ship`, not this plan. Do not run
  `npm audit fix`, do not touch `package.json` or `package-lock.json`.
- Widening the gate to other i18n helper names (`$tc`, `te`, a renamed
  binding) — see `## Deferred`.
- The orphan rule, the `unknownKeys` rule, `composedThemeKeys`, and the other
  three gates. This unit changes how a set is *collected*, not what is done
  with it.

## Assumptions

**The empty prefix stays matchable — `[\w.]*` is kept, not tightened to `+`.**
This is the one fork, and it is recorded rather than asked because it is
reversible by one character.

Once the boundary lands, an empty capture can only come from a genuine
`t('' + k)` or ``t(`${k}`)`` — a fully dynamic key the gate can compose nothing
for. That is precisely what the tripwire assertion exists to surface: the set
becomes `['', 'theme.']`, the assertion fails, and a human decides. Tightening
to `+` would make that call match nothing and pass in silence, trading a loud
correct signal for quiet. The `*` is only a defect while the boundary is
missing; with the boundary it is the wanted behaviour, and the unit writes that
reasoning into the file as a comment so the next reader does not "fix" it back.

**Confirmed by the user on 2026-08-20**, so this is a decision rather than a
recorded guess: keep `*`. The reasoning agreed with was that a fully dynamic
`t('' + k)` passing in silence is worse than the same call turning the tripwire
red, because silence is the failure nobody investigates.

To reverse: change `*` to `+` in both branches and drop the `t('' + k)`
scenario. One edit, no other consequence.

## Units

### U1 — Give the composed-prefix scan a call boundary

- **Goal:** `dynamicPrefixes` records a prefix for `t` / `$t` calls and for
  nothing else.
- **Depends on:** none
- **Mode:** vertical slice
- **Files:** `src/meta/locales.test.js` — confirmed to exist. Enumerable, one
  file. Permitted: the `dynamicPrefixes` helper and its doc comment, and new
  `it(...)` blocks asserting it. Forbidden: changing the `.toEqual(['theme.'])`
  expectation of the existing tripwire test, changing any other helper, and
  touching any file outside `src/meta/locales.test.js`.
- **Authority:** none needed. Nothing here acts outside the working tree — no
  repository setting, no network, no credential, no dependency install.
- **Approach:** the fixtures land **before** the fix, because a real red is
  available here for free and this unit's acceptance criteria ask for both runs.
  Writing the fix first would make the fixture pass on its first run, and a
  first-run pass proves nothing about whether the assertion can fail at all.
  1. Add the fixture tests below beside the existing `themeNamesIn` /
     `unknownKeys` fixture tests, in the same `describe` block that owns the
     tripwire assertion. Nothing else changes yet.
  2. Run the repo's focused command and **record the failure output**. Confirm
     it is the ordinary-call fixture failing on its own assertion — six phantom
     prefixes where none were expected — and not a typo or a missing import.
     That paste is the red half of this unit's evidence.
  3. Now prefix both patterns with a `(?<![\w$])` lookbehind, so the `t` opening
     the call is not preceded by an identifier character or a `$`:

     ```
     /(?<![\w$])\$?t\(\s*['"`]([\w.]*)['"`]\s*\+/g
     /(?<![\w$])\$?t\(\s*`([\w.]*)\$\{/g
     ```

     A member call keeps working —
     `.` and `(` are not in the excluded class, so `i18n.t(` and `this.$t(`
     still match, which is right: both are real call sites.
  4. Run again and record the green. The same fixture that just failed now
     passes, and the live tripwire is still `['theme.']`.
  5. Extend the doc comment above the helper with the two things a later
     reader will otherwise re-litigate — why the lookbehind is there (six
     ordinary call shapes matched without it), and why the capture stays `*`
     (an empty prefix from a real `t` call is a finding the tripwire should
     report, not noise to discard). Mirror the tone of the `.skip(` comment in
     `src/meta/traceability.test.js:41-46`.
  6. Leave the live tripwire assertion at `['theme.']` untouched throughout. It
     is the proof that the fix changed nothing about today's tree.
- **Does not catch:** the helper is a regex over file *text*, taken from the
  first argument of a call, so it is blind to —
  - a composed call whose literal half is not the first thing inside the
    parens: `t(prefix + '.' + name)`, `t(KEYS.theme + x)`, `t(keyFor(x))`. No
    prefix is recorded and the composed keys read as orphans instead, which is
    a red suite blaming the wrong line;
  - a key composed outside the call — `const k = 'theme.' + x; t(k)`;
  - an i18n helper not named exactly `t` or `$t`: `$tc(`, `te(`, `translate(`,
    or a locally renamed binding. There is no such call in this repo today;
  - anything runtime: a prefix that only exists once the module runs, or a key
    the framework builds, is invisible to a text scan;
  - whether the composed keys actually exist. That is `composedThemeKeys` +
    `orphans`, a separate mechanism this unit does not touch;
  - calls in the files the scan already excludes — `*.test.js` and
    `src/i18n/locales/`. This is why the new fixtures, living in a `.test.js`,
    cannot poison the live scan; it is also why a composed call written inside
    a test is invisible to the gate.
- **Test scenarios:**
  - happy: `$t('theme.' + t)` and ``t(`theme.${t}`)`` each yield `['theme.']`
  - error (the regression fixture): a source containing `format('x' + y)`,
    `expect('a.b' + c)`, `parseInt('' + n)` and `split('.' + sep)` yields `[]`
    — red before the change, green after, both runs recorded
  - edge: `i18n.t('theme.' + x)` and `this.$t('theme.' + x)` still yield
    `['theme.']`, because a member call is a real call site
  - edge: `t('' + k)` yields `['']`, so a fully dynamic key reaches the
    tripwire assertion instead of vanishing (see `## Assumptions`)
- **Verification:** the fixture containing four ordinary non-i18n calls
  produces no prefixes, while `$t('theme.' + t)` still produces `theme.`; and
  the gate's scan of the live 18 call-site files still produces exactly
  `['theme.']`, so `npm run test` stays green. Both observations are made from
  inside this unit's one file — the helper is module-local and the live scan is
  the file's own top-level code.
- **Acceptance criteria:**
  - The ordinary-call fixture fails against the current helper and passes
    against the fixed one, with both runs in the record.
  - `npm run test` passes, and the tripwire assertion still reads
    `['theme.']` unchanged.
  - The `Does not catch:` boundary above is written into the file as the
    helper's comment, so it is arguable from the source rather than from this
    plan.

## Order

```
U1
```

Single unit, depth one. Nothing to parallelise and nothing waiting on it.

## Deferred

Open on purpose; do not close either by guessing.

- Should the gate recognise i18n helpers other than `t` / `$t` — `$tc`, `te`,
  or a renamed binding? Needs a real call site to be worth a rule; there is
  none in this repo today. Trigger: the first such call landing under `src/`.
- Should an empty prefix be its own hard failure with its own message, rather
  than surfacing through the tripwire's array diff? Answerable once a real
  fully-dynamic `t()` call exists to read. Today it is hypothetical, and a
  message written for a hypothetical is usually wrong.
- The six npm advisories and the vite/vitest major bump. Not deferred by
  oversight — explicitly assigned to `ev-ship` as an accepted risk, and out of
  scope above.

## Log

- 2026-08-20 run-mode: checkpoint — no mode word in the request; the plan is one unit, so the checkpoint is the end
- 2026-08-20 U1 done — 1086c93 — 3/3 evidenced — .evidence/work/2026-08-20-locales-gate-prefix-regex/U1.md
- 2026-08-20 verified-through: U1 @ 1086c93 — record read, criteria evidenced, suite green (9 files, 1015 tests)
- 2026-08-20 plan closed: every unit done. The frontmatter `status: ready` did its job — ev-work picked the plan up and named the word — and now moves to `done` rather than `draft`, the run being over.
- 2026-08-20 correction to the prose above: `## Problem frame` and U1 say six phantom prefixes; the fixture named in `Test scenarios` has four calls, so the observed red was four (`x`, `a.b`, `""`, `.`). Six was the count over the eight-call synthetic set in `## Grounding`. The defect and the fix are unchanged.
