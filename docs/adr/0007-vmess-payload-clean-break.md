# 0007 The vmess payload is base64 of UTF-8 JSON bytes, with no tolerance for the shape we used to write

Since the initial commit the generator wrote the `vmess` payload as `btoa(encodeURIComponent(json))` — base64 of a *percent-encoded* JSON string. A client following the ecosystem convention base64-decodes and parses JSON, and gets a string starting `%7B` instead of an object. Reproduced against `cd3bc3f`: the standard decode path fails with `Unexpected token '%'`. No `vmess` link this tool has ever produced has opened in a client.

Nothing inside the app read back what it wrote, so the app had no symptom to show. The project's own parser fails the same way and hides it: `parseVmess` catches the parse error inside its own `try`/`catch` and returns `null` with no message. One module worked around the encoding instead of reporting it — `dedup.js` tolerated both payload shapes on read so dedup kept working, with a comment naming the generator as the source of the percent-encoding. The workaround stopped there and never reached the parser.

The payload was also written twice, not once. `buildVmess` encoded it, and `withRemark` in `dedup.js` re-encoded every surviving link the same way when it stamped the numbered remark. `generateLinks` routes every generated link through `dedupeAndNumber`, so dedup is the *last* writer of every `vmess` link the app hands the user: fixing only the builder would have left the emitted output unchanged.

## The decision

The emitted payload is base64 of UTF-8 JSON bytes — readable in one decode step, by any client, with no second decoding pass. Both write sites call one encoder, `encodeBase64` in `parser.js`, which is the exact inverse of the `decodeBase64` that already lived beside it. `btoa` alone is not that encoder: it takes one byte per code unit and throws above U+00FF, so a remark carrying Persian text or an emoji never reaches it.

**And no read path retains tolerance for the old shape.** An old-shape link is refused: `parseVmess` returns `null`, the row becomes an unparsed row, and the existing `rows.unparsedError` message renders in all four locales. `dedup.js` no longer accepts it either.

The clean break is cheap because of one assumption: **no user holds a working `vmess` link from this tool**, since the output has been non-standard since the initial commit. If that turns out false — some clients are lenient about payload decoding — this is the decision to revisit, and the manual real-client check is the earliest place it would surface.

Refusal stays quiet and non-fatal. `parseVmess`'s silent `try`/`catch` is unchanged, because R8's user-visible refusal is already delivered by the null return plus the existing unparsed-row message. `withRemark` guards its decode and returns the link unchanged rather than throwing: numbering runs over the whole run at once, so throwing on one unreadable link would cost every other link's output.

## What the break costs

With the dual-shape tolerance gone, an old-shape link states no identity, so it falls back to its own bytes and matches only a byte-identical twin. Two old-shape links differing only in their remark no longer collapse into one — a dedup case that used to work and now does not. Accepted, not mitigated, and asserted in `dedup.test.js` so the loss reads as deliberate rather than as a regression someone should fix.

Deliberate refusal fixtures — the two hard-coded old-shape base64 literals in `dedup.test.js` and `parser.test.js` — are the only place the old shape appears in the repository, and they are literals rather than payloads built by encoding, so no helper here can produce it again.

## Why a gate came with the fix

Two structural reasons the existing safety net missed a defect present since the first commit: nothing in the system ever read back what the generator wrote, so there was no place the mismatch could surface; and the tests that inspected generated `vmess` output decoded it with an extra `decodeURIComponent`, which asserted the non-standard shape as the expected one. Both source sites could be corrected and the suite would stay green either way.

V19 closes that loop — every emitted link is parsed back, through the project's parser *and* through a decoder written independently of it, and every field the generator intends to write is asserted to come back intact. The guarantee is field preservation, not string identity: the builder deliberately rewrites address, port, remark and TLS state, so the emitted link is never the input link.

## Considered Options

- **Fix `buildVmess` only**: leaves `withRemark` re-encoding the old shape as the last writer, so the emitted output does not change at all. Not a fix, a plausible-looking one.
- **Keep a tolerant read path**: preserves a dedup case, at the cost of keeping the broken shape alive inside the pipeline and leaving no way to tell a stale link from a current one. There are no working old links to protect, and blocking beats silent breakage (ADR-0001).
- **Make the parser loud about the refusal**: the null return plus the existing unparsed-row message already delivers the user-visible refusal in all four locales; a thrown error inside `dedupeAndNumber` would cost the whole run's output for one bad link.
- **A runtime self-check that refuses to emit any link the app cannot read back**: changes product behaviour and carries a four-locale string cost. A separate decision, not this one.
- **Assert the payload round-trips through our own parser only**: a parser that mirrors a builder mistake makes that gate pass — which is exactly the failure mode here, since `decodeBase64`'s percent-escape read was the inverse of the broken encoder. Hence the second, independent decode path.
- **A property-based testing library**: a randomising library still needs the same intended-field map to assert against, so it adds input variety only — which five to seven hand-picked rows supply without opening the dependency argument (ADR-0003).
