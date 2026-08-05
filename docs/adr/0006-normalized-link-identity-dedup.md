# 0006 Normalised link identity and dedup

Customs/testing the deployed app against real configs on 2026-08-03 produced duplicate links and colliding remark numbers. Pasting the No-TLS and TLS variants of one endpoint — identical except port and TLS params — generated 8 links that reduced to 4 semantically distinct links. Raw-string comparison missed two of the collapses because the origin configs' param ordering survived the spread, so the other pair differed only in `key=value` order. Exact-string identity is therefore wrong: a sane client resolves a reordered query identically, so order-differing pairs are the same link, not two.

We define a generated link's **identity** as the set of query `key=value` pairs (compared order-insensitively) plus address, port, security, transport and any other link-shaping fields — excluding the remark. Passwords aside, generated links with equal identity are deduplicated. This changes V1's "No dedup loss": the output is no longer predictable from the input arithmetic, because collapsed links are dropped (first-wins).

vmess participates: its remark is `ps` inside a base64 JSON object rather than a fragment, so identity for vmess means decoding, deleting `ps`, and comparing the rest. Excluded rows copied through raw under the opt-in checkbox are not deduplicated — they are the user's own text, kept verbatim (V5).

## Numbering is the last step

The remark counter is per-config today, so two rows sharing a remark both produce `SS-001`, `SS-002`, and so on. The fix and the dedup only compose in one order. Deduplicate on the link *without* its remark, then number what survives: numbering has to be the last step, or surviving numbers get holes (`001, 002, 003, 004, 006, 008`).

The counter's scope becomes **per distinct remark text**: each label runs its own `001-N` sequence, restarted at each new remark. A label's numbers cannot collide with another label's, so uniqueness holds within the run. Configs with no remark share an implicit `config-` sequence.

Deduplication drops at most one label per surviving link, so the UI reports how many were dropped ("X duplicate links removed") rather than silently returning fewer than the arithmetic implies — silently dropping things is what produced the original defect (ADR-0004).

## Considered Options

- **Exact-string identity**: cheap, but demonstrably misses the reordered-query pair, which occurred in the very first real test. Rejected because it preserves the reported duplicates.
- **Global counter for the whole run**: numbers jump between labels (`SS-001..004` then `Iran-005..`), so no label reads `001-N` on its own and V4's "no gaps" cannot be stated per label.
- **Per-config counter (status quo)**: the colliding `SS-001` labels are the reported defect.
- **Silent drop**: saves a UI label but contradicts ADR-0004's stance that silent dropping caused the original bug.
