---
title: The vmess payload no client could read, and the test suite that could not tell
date: 2026-08-14
category: logic-errors
module: vmess-payload-encoding
problem_type: logic_error
component: service_object
severity: high
symptoms:
  - "Every vmess:// link generateLinks produced since the initial commit failed to open in a standard client: base64-decoding and JSON.parse on the payload yielded a string starting with \"%7B\", not a JSON object, because the payload was btoa(encodeURIComponent(json)) instead of base64 of UTF-8 JSON bytes"
  - "The defect was invisible from inside the app: nothing in the codebase ever read back what the generator wrote, so there was no place the mismatch could surface"
  - "parseVmess always rejected the tool's own vmess output, returning null, but nothing ever fed generated output back into it and the try/catch swallowed the disagreement with no message"
  - "The readers that did touch the payload had been adapted to the broken shape: dedup's vmessConfig carried a second decodeURIComponent fallback, and the tests read payloads with an extra decodeURIComponent that is a no-op on ASCII, so both accepted either encoding"
root_cause: wrong_api
resolution_type: code_fix
related_components:
  - testing_framework
tags:
  - vmess
  - base64
  - utf-8
  - encoding
  - round-trip
  - codec-symmetry
  - dedup
  - silent-failure
---

# The vmess payload no client could read, and the test suite that could not tell

> **Provenance.** This work is PR #16, branch `fix/vmess-round-trip-gate`, merged into `master` at 2026-08-14T00:48:30Z. Governance for it lives in the repo: defect `B11` and invariant `V19` in `SPEC.md`, and the decision record at `docs/adr/0007-vmess-payload-clean-break.md`. `file:line` citations below are against the branch tree the PR contributed.

## Problem

Since the initial commit, this tool wrote its `vmess://` payload as base64 of a **percent-encoded** JSON string — `btoa(encodeURIComponent(json))`. The ecosystem convention, the v2rayN `VMessQRCodeFormat` object, is base64 of **UTF-8 JSON bytes**: a client base64-decodes the payload and hands the result straight to a JSON parser, with no step in between.

A client doing that against our output got a string beginning `%7B%22v%22...` and a parse error. Not a subtly wrong field, not a compatibility edge — the object never materialised. **No `vmess` link this tool ever produced could be opened by a standard client.** Every `vless`, `trojan` and `ss` link worked; one of the four schemes had been emitting garbage for the life of the repository.

It went unreported for the mundane reason that the repo was never advertised and its owner uses `vless`. It went *undetected* for reasons that are worth far more than the fix, because they are reproducible in any codebase where a writer and a reader are supposed to be inverses of each other:

**1. The payload was written twice, and the fix-looking site was not the last one.** `buildVmess` in `src/utils/multiplier.js:108` encodes the payload. `withRemark` in `src/utils/dedup.js:123` decodes it again and **re-encodes** it when it stamps the numbered remark. `generateLinks` routes every generated link through `dedupeAndNumber` (`src/utils/generation.js:122`), so dedup is the *last writer* of every `vmess` link the app hands the user. Correcting only the builder would have left the emitted bytes identical — a fix that reads as complete and changes nothing.

**2. Nothing in the system read back what the generator wrote.** No component consumed the emitted links; the output is copied to a clipboard and pasted into someone else's client. There was no surface anywhere in the app on which the mismatch could appear.

**3. The one reader that would have caught it was never pointed at the output — and it failed silently when it was.** `parseVmess` (`src/utils/parser.js:83-112`) has always **rejected** the old shape: `decodeBase64` (`src/utils/parser.js:144-158`) is a correct base64-of-UTF-8-bytes decoder, so on a percent-encoded payload it returns the literal string `%7B%22v%22…` and `JSON.parse` fails. Verified directly: `parseVmess` on an old-shape link returns `null` both at `cd3bc3f` and at the branch head, where the decoder is byte-identical.

So the codebase already contained a check that disagreed with the generator. Two things kept anyone from hearing it. Nothing ever fed generated output back into the parser — the app's own writer and its own reader never met. And the disagreement, when it did occur on a pasted link, was swallowed: the `try`/`catch` at `src/utils/parser.js:109-111` turns any parse failure into a bare `return null`, with no message.

**4. The two readers that *did* touch the payload had each been adapted to accept the broken shape.** This is where the writer's mistake was actually mirrored, and neither place was the parser:

- **In production:** `dedup.js`'s old `vmessConfig` wrapped the decode in a fallback — `try { JSON.parse(raw) } catch { return JSON.parse(decodeURIComponent(raw)) }` — an *extra* decode step that existed precisely because our generator percent-encoded. That is the reader that made the broken shape work inside the pipeline.
- **In the tests:** wherever a test inspected a generated payload it read it with `JSON.parse(decodeURIComponent(atob(...)))`. On ASCII content that extra `decodeURIComponent` is a no-op, so the assertions passed against *either* encoding. The suite was not weak on this path — it was *blind* to it.

**5. The workaround was written down, and it was never filed.** `dedup.js`'s fallback carried a comment naming our own generator as the source of the percent-encoding — "our own generator percent-encodes before base64… Tolerate both". The knowledge existed in the codebase, in prose, next to the bug. It never travelled the ten lines to the parser or out to a defect record.

## Symptoms

- A `vmess://` link generated by this tool, pasted into any standards-following client, fails to import. Decoding the payload by hand yields `%7B%22v%22%3A%222%22...` and `JSON.parse` reports `Unexpected token '%'`.
- Nothing surfaces inside the app: `parseVmess` returns `null` silently, so a pasted old-shape link is only ever an "unparsed row".
- The failure is invisible to the test suite. **Verified for this document:** on `master` at `cd3bc3f`, replacing the encoder at *both* write sites with the correct UTF-8-bytes encoder leaves all **140** tests green (`npm test`, which is `vitest run`, `package.json:10`). The old suite could not distinguish the two encodings in either direction.
- A comment inside `dedup.js` describing our generator's own percent-encoding as a shape to tolerate — a workaround note standing in for a bug report.

## What Didn't Work

**Fixing `buildVmess` alone.** The obvious one-line change, and it does not alter a single byte of output. `withRemark` re-encodes every surviving link afterwards. Any fix here had to be a *set* of write sites, identified by asking "who writes this last?" rather than "where is it built?".

**Naming the second write site as merely a reader. (session history)** The first draft of the plan described `dedup.js` only as a "compatible reader", not as a publish site. Doc review caught it: a fix scoped to where the plan pointed would still have shipped broken links post-dedup. The structural fact — that dedup is the last writer — had to be written into the requirement itself before the fix could be correct.

**Aiming the load-bearing check at the wrong function. (session history)** More pointed still: the plan's own "prove the gate catches this" step originally reverted the *builder*. Because the read tolerance was still in place at that point, reverting the builder proved nothing — dedup would decode the old shape and re-emit it correctly, and the gate would stay green. The check had to be retargeted at the last writer. **The verification of the guard had the same last-writer bug as the fix it was verifying.**

**`btoa(json)` as the corrected encoder.** The naive inverse of the mistake — just delete the `encodeURIComponent` — is also wrong. `btoa` takes one byte per code unit and **throws** on anything above U+00FF, so it works on ASCII and blows up on exactly this app's audience: a Persian remark or an emoji in `ps` never reaches it. The percent-encoding was almost certainly there to route around this in the first place. The encoder has to go through UTF-8 bytes, which is why `encodeBase64` at `src/utils/parser.js:137-142` maps through `TextEncoder` and only then calls `btoa`, and why the reasoning is recorded in the comment above it rather than left for the next person to rediscover. (This trap was flagged during planning, before implementation — session history.)

**Reaching for whichever reader was closest.** The instinct on discovering this is "add a test that reads our output back". Which reader you grab decides whether that test is worth anything, and the answer here was not obvious:

- `parseVmess` would have caught it — it rejects the old shape outright.
- `dedup.js`'s `vmessConfig`, the reader that actually sat in the pipeline, would **not** have. Its fallback was written to accept the broken shape, so a gate built on it would have gone green on output no client can open.

Two readers in one small codebase, one useful for this and one useless for it, and nothing in either signature says which. The property that separates them is not quality — it is whether the reader was ever *adapted to the writer's output*. An adapted reader cannot testify about the writer. Picking by hand means getting that judgement right every time, on a codebase that keeps changing; the gate instead uses a decoder that **cannot** be adapted, because it is written from the published grammar and imports nothing.

**Keeping the dual-shape read tolerance for compatibility.** Considered and rejected in ADR-0007: there is nothing to be compatible *with*. No user holds a working old-shape link, because the old shape never worked. Retaining tolerance would keep the broken shape alive inside the pipeline and remove any way to tell a stale link from a current one.

**Assuming the new gate works because it is green.** It was green, and it had a hole in it. See *Why This Works*.

## Solution

**One encoder, defined as the exact inverse of the reader that already existed.** `encodeBase64` (`src/utils/parser.js:137-142`) encodes to UTF-8 bytes and base64s them, and sits directly above the `decodeBase64` it inverts, so the pair is read together.

**Both write sites call it.** `src/utils/multiplier.js:131` (`const b64 = encodeBase64(json)`) and `src/utils/dedup.js:128`. The comment at `src/utils/dedup.js:114-117` now states the structural fact in the code itself: *this is the last writer of every vmess link the app emits, so an encoding the multiplier gets right and this site gets wrong is still wrong in the output the user is handed.*

**The dual-shape tolerance is gone.** `vmessConfig` at `src/utils/dedup.js:59-61` is now a single strict decode. `readableVmessConfig` (`src/utils/dedup.js:73-82`) is the shared "unreadable" posture for both the identity side and the rewrite side, and it rejects non-object payloads too — a payload of `123` or `"text"` parses fine and then throws a `TypeError` at `obj.ps = remark`, costing the entire run's output, which is precisely the loss the guard exists to prevent. An old-shape link now states no identity and keeps its own label rather than being quietly absorbed and re-emitted. The cost is recorded and asserted rather than hidden: two old-shape links differing only in remark no longer collapse into one (ADR-0007, "What the break costs").

**Invariant V19 — the round-trip gate** (`src/utils/roundtrip.js`, `src/utils/roundtrip.test.js`). Every link `generateLinks` emits — post-dedup, post-numbering, which is the only state the user ever sees — is read back through **two independent paths** and compared field by field against a per-scheme map of what the generator *intends* to write:

- `INTENDED_FIELDS` (`src/utils/roundtrip.js:436-445`) is a specification, not a fixture. Field names come from each scheme's client-facing grammar — the v2rayN object for `vmess`, XTLS/Xray-core issue #91 for the query schemes — explicitly **not** read off `multiplier.js`, because a map derived from the builder only asserts that the builder equals itself (`src/utils/roundtrip.js:11-15`).
- The independent decoder (`decodeLink`, `src/utils/roundtrip.js:462`; `decodeVmessLink`, `src/utils/roundtrip.js:561`) **imports nothing from `parser.js` and nothing from `multiplier.js`** — stated as a design constraint at `src/utils/roundtrip.js:34-39`. `jsonFromBase64` (`src/utils/roundtrip.js:590-598`) base64-decodes and `TextDecoder`s with `fatal: true`, then `JSON.parse` runs directly on the result. An old-shape payload **throws** here. That refusal is the feature.
- `assertEntry` (`src/utils/roundtrip.test.js:578-588`) runs each map entry against both paths; the gate loop at `src/utils/roundtrip.test.js:590-620` emits one `it` per field per row per scheme. The guarantee is **field preservation, not string identity** — the builder rewrites address, port, TLS state and remark by design, so an emitted link can never equal its input.

**The gate was proven load-bearing by mutation, not assumed.** **Re-measured against the current tree for this document:** restoring the old encoder at `src/utils/dedup.js:128` fails **2 test files** — vitest reports **9 failed tests, and 180 of 973 never run at all**, because each vmess gate row's `beforeAll` throws on the unreadable payload and its assertions never execute. (Read that shape before trusting a mutation count: a thrown hook fails the suite loudly but reports far fewer *failed tests* than it actually invalidated. An earlier draft of this doc quoted the bare "9" and undersold the blast radius by twentyfold.) Reverting the single line returns all 973 to green. Separately, emitting query values raw reddens the reserved-character rows.

Tests moved **140 → 973** on this branch (measured with `npm test` on `master` at `cd3bc3f` and on the branch head).

## Why This Works

The fix is three lines of encoder. The reason it *stays* fixed is that the check now has no way to share the bug.

Round-trip testing is a strong technique that quietly degrades into a tautology. "Write it, read it back, assert it matches" only proves the writer correct if the reader is independently correct — and a codebase steadily *manufactures* readers that are not, because every reader that has to cope with a broken writer gets adapted to it. That is what happened here: `dedup.js` had to keep working against our own output, so it grew a fallback that accepted the broken shape, and from that moment the pipeline contained a reader guaranteed to agree with the bug. Round-tripping through it would have asserted that a function composes with its own inverse. It always will.

The parser, never adapted, disagreed the whole time — and nobody heard it, because no test ever put generated output in front of it. Both halves of that are the lesson: an unadapted reader is worth having, and it is worth nothing until something feeds it the real output.

`roundtrip.js` breaks that loop by construction, not by discipline. The import ban is what makes it work: there is no path by which a mistake in `parser.js` or `multiplier.js` can propagate into the checking code, because the checking code cannot see them. The decoder is written from the published grammar with platform primitives only, and it **throws rather than returning null** on anything it cannot read (`src/utils/roundtrip.js:456-460`) — a decoder that fails quietly is the exact shape of the defect the module exists to catch.

The map's independence carries the same weight. Field names and semantics come from the external grammar; where the builder and the grammar disagree, the disagreement is a comment at the bottom of the file (`src/utils/roundtrip.js:600-630`), never a silently-adjusted expectation. That distinction — *pin the builder's current intent, record the open question, never quietly ratify* — is what keeps the map from drifting into a description of whatever the code happens to do.

And the gate is anchored at the **right end of the pipeline**. It reads the output of `generateLinks`, not of `buildVmess`. Had it been written against the builder, the fix would have looked complete and `withRemark` would still be shipping the old shape. Where you attach a gate is a claim about who writes last; getting that wrong makes the gate agree with a bug it was built to catch.

### The gate had the same flaw as the code it guards

The most valuable finding of this work arrived during code review, *after* the gate was written, green, and believed.

The reserved-character row originally used a path of `/ws?ed=2048`. It looked like the hard case. It was not: a `?` inside a query *value* is not a delimiter, so **both** decode paths recover `/ws?ed=2048` whether or not the builder percent-encodes anything. That row — and the test literally named for not splitting the query — would have stayed green with the percent-encoding deleted. The row asserted a property it could not fail.

`&` is the character that actually discriminates. The row now carries `path: '/ws?ed=2048&leak=1'` (`src/utils/roundtrip.test.js:509`), with `leak` chosen as a parameter name neither builder writes and the `vmess` key whitelist does not carry, so its appearance can only mean the path split (`src/utils/roundtrip.test.js:625-638`). Mutating `buildQueryLink` to emit raw values now reddens the per-scheme rows *and* the named rule test. The reasoning is written into the test file at `src/utils/roundtrip.test.js:498-502` so the next person cannot "simplify" the fixture back.

**A gate can have exactly the same self-satisfying flaw as the code it guards.** A test that cannot fail is indistinguishable from a passing test right up until the day you need it.

## Prevention

**1. Never validate a writer through a reader that was adapted to it.**

This is the generalisable rule and it is worth stating twice, because "we round-trip it" *sounds* like proof:

> Testing a writer through a reader that had to cope with that writer proves only that the two still agree. Any reader downstream of a broken writer will have been bent toward it — that is what "it works for us" is made of. Validate against a decoder written independently, from the specification.

The tell is not code quality, it is **lineage**: ask of each reader, *was this ever changed to make our own output work?* Here `dedup.js` had been, and `parseVmess` had not — which is exactly why one was useless as an oracle and the other was not, and why neither's signature told you so.

The shape that works here, and transfers unchanged:

```js
// roundtrip.js — imports nothing from parser.js or multiplier.js, by design.
export function decodeVmessLink(link) {
  const payload = jsonFromBase64(text.slice('vmess://'.length))  // base64 → UTF-8 bytes
  const config = JSON.parse(payload)                             // …then JSON, nothing between
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(...)
  return { /* normalised to parseConfig's shapes, but never defaulted like it */ }
}
```

and the two-path assertion, which is what makes the second implementation pay:

```js
// roundtrip.test.js — each map entry, both paths, per emitted link.
const parsed  = parseConfig(emitted)   // the project's own reader
const decoded = decodeLink(emitted)    // the independent one
for (const entry of intendedFields(scheme)) assertEntry(entry, ctx, parsed, decoded)
```

Neither path alone can make the gate pass. The parser path proves the app stays self-consistent; the independent path proves the app matches the world.

**When a second implementation is worth its cost.** It is not free — `roundtrip.js` is ~630 lines against a three-line fix. Build one when:

- The output crosses a **trust boundary** and is consumed by software you do not control (wire formats, file formats, links, exports, API payloads). Nobody downstream will file the bug politely; they will just see a broken import.
- The **external contract is written down** somewhere you can read it — an RFC, a reference implementation, a published format. If the spec *is* your code, a second implementation is theatre.
- The **available readers have been adapted to the writer** — a fallback, a tolerance, a "handle both shapes" branch added so something downstream kept working. That is the precise condition under which the round trip is a tautology, and it is created by ordinary maintenance rather than by carelessness.
- **Nothing in the system reads back what it writes.** No internal consumer means no natural place for a mismatch to surface, and the format can be wrong for years.

Skip it when the format is internal and both ends ship together (a wrong-but-symmetric encoding is simply the format), when the "spec" is your own data model, or when a cheap external oracle already exists — a real client, a reference CLI, a published conformance vector. Prefer the oracle to a hand-written second implementation whenever one exists; this project's `vmess` object had no runnable one to hand, which is what justified writing the decoder.

**2. Mutate the guard before you trust it.** A guard nobody has tried to break is an assumption wearing a test's clothing. The habit that caught the hole here, and that costs about a minute:

- Re-introduce the exact bug the guard exists to catch, run the suite, and **read which tests go red and how many**. Nine, in two files, for the encoder here — a number small enough to check that the *right* tests failed, not merely that something did.
- Then break the adjacent thing the guard also claims to cover (raw query values, in this case), and confirm the named rule test — the one whose title states the property — is among the failures. A row that stays green under a mutation of the property it names is asserting nothing.
- Revert and confirm the suite returns to green, so the mutation cannot leak into the commit.
- **Point the mutation at the last writer.** Reverting the builder while a downstream site still corrects the output proves nothing — this plan originally made exactly that mistake (session history).

The `/ws?ed=2048` row survived a code review's reading and would have survived forever without this step. Green is not evidence; *red on demand* is.

**3. Write assertions from the spec, never from the implementation.** If the expected value is read off the code under test, the test asserts that the code equals itself. Where the implementation and the spec genuinely differ, record the difference as a comment (`src/utils/roundtrip.js:600-630`) and pin current behaviour deliberately — do not quietly adopt the implementation's view as the expectation.

**4. Attach the gate to the last writer.** Ask "what byte does the user actually receive?" and test *that*. In this pipeline the answer is the output of `generateLinks` — after dedup, after numbering — not the builder's interim string. A gate on the builder would have been satisfied while `withRemark` shipped the defect.

**5. A workaround for someone else's bug is a bug report you owe someone.** `dedup.js` carried a comment naming our own generator's percent-encoding, and tolerated it so dedup kept working. That is the moment the defect was actually discovered; it simply was never *filed*. When you find yourself writing "tolerate both shapes because X writes it wrong", stop and either fix X or record the defect. Tolerance code is the sound a bug makes while it settles in.

**6. Watch for silent `catch` on a parse boundary.** `parseVmess`'s `try { ... } catch { return null }` (`src/utils/parser.js:109-111`) is fine as product behaviour — the row renders as unparsed, in all four locales — but it means the *most* diagnostic event in the system produced no signal at all. Where a silent catch is the right product call, the compensating control belongs in the test suite, which is exactly what V19 is.

## Related Issues

- `docs/adr/0007-vmess-payload-clean-break.md` — the decision record for this fix: why the old shape is refused rather than tolerated, the assumption that makes the clean break cheap, and the dedup collapse case it costs. This doc covers the debugging story; the ADR covers the decision.
- `SPEC.md` — defect `B11` (`§B`) and invariant `V19` (`§V`), added by this work.
- `docs/adr/0006-normalized-link-identity-dedup.md` — establishes that numbering is the last pipeline step, which is the structural fact that made `withRemark` the last writer and fixing `buildVmess` alone insufficient. This defect is a direct consequence of that ordering decision. Reading 0006 alone would not reveal the old-shape carve-out that 0007 introduces; a pointer between them would help.
- `docs/adr/0005-shadowsocks-xray-native-dialect-only.md` — the contrasting design point: the `ss` credential is carried verbatim and never decoded, so decode/re-encode symmetry cannot bite it. `vmess` is the one scheme where that symmetry mattered, which is part of why the defect was scheme-specific.
- PR #16 — carries the entire change set, and its description records the residuals: the pre-existing `__proto__` gap in `vmessIdentity`, `V4`'s unstated exception for a link `withRemark` cannot rewrite, and the fact that `V19` binds only where the suite is run (the deploy workflow runs install and build only).
- No GitHub issue tracks this defect; the tracker's existing issues (#1–#14) concern the routing-subdomain and dedup/numbering chains.
