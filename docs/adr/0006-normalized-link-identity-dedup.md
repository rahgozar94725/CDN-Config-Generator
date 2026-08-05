# 0006 Normalised link identity and dedup

Customs/testing the deployed app against real configs on 2026-08-03 produced duplicate links and colliding remark numbers. Pasting the No-TLS and TLS variants of one endpoint — identical except port and TLS params — generated 8 links that reduced to 4 semantically distinct links. Raw-string comparison missed two of the collapses because the origin configs' param ordering survived the spread, so the other pair differed only in `key=value` order. Exact-string identity is therefore wrong: a sane client resolves a reordered query identically, so order-differing pairs are the same link, not two.

We define a generated link's **identity** as the set of query `key=value` pairs (compared order-insensitively) plus address, port, security, transport and any other link-shaping fields — excluding the remark. Passwords aside, generated links with equal identity are deduplicated. This changes V1's "No dedup loss": the output is no longer predictable from the input arithmetic, because collapsed links are dropped (first-wins).

vmess participates: its remark is `ps` inside a base64 JSON object rather than a fragment, so identity for vmess means decoding, deleting `ps`, and comparing the rest. Excluded rows copied through raw under the opt-in checkbox are not deduplicated — they are the user's own text, kept verbatim, and they hold the position of their row so the output is still the list the user pasted (V5).

## A random SNI is a nonce, not an identity

Random SNI regenerates the `sni` value for every link it builds. Left in identity, no two links ever match, so dedup is off for exactly the users who have the option on and the reported duplicates come straight back. A value that is different every time it is computed distinguishes nothing: two links differing in nothing but a nonce are one link. Identity therefore ignores `sni` — the query pair for vless/trojan/ss, the `sni` field for vmess — when random SNI is on. Nothing is lost, because `host` carries the routing subdomain unrandomised, so links that route differently still differ.

The engine is told the SNI is random rather than inferring it. Inferring would mean either reading the option out of a link it cannot see, or always ignoring `sni` on the argument that generated links write `sni` equal to `host` anyway — true today, and a silent collapse of genuinely different links the day it stops being true.

## Numbering is the last step

The remark counter is per-config today, so two rows sharing a remark both produce `SS-001`, `SS-002`, and so on. The fix and the dedup only compose in one order. Deduplicate on the link *without* its remark, then number what survives: numbering has to be the last step, or surviving numbers get holes (`001, 002, 003, 004, 006, 008`).

The counter's scope becomes **per label base**: each label runs its own `001-N` sequence, restarted at each new one. A label's numbers cannot collide with another label's, so uniqueness holds within the run. Configs with no remark share an implicit `config-` sequence.

The counter is keyed on the label base — the remark text, or `config` where there is none — and not on the remark text alone. Keyed on the remark, an empty remark and a remark that is literally `config` are two sequences writing into one label space, and both emit `config-001`: the very collision this decision exists to prevent, reappearing in a corner. A config genuinely labelled `config` therefore shares the implicit sequence.

Deduplication drops at most one label per surviving link, so the UI reports how many were dropped ("X duplicate links removed") rather than silently returning fewer than the arithmetic implies — silently dropping things is what produced the original defect (ADR-0004).

## Considered Options

- **Exact-string identity**: cheap, but demonstrably misses the reordered-query pair, which occurred in the very first real test. Rejected because it preserves the reported duplicates.
- **Global counter for the whole run**: numbers jump between labels (`SS-001..004` then `Iran-005..`), so no label reads `001-N` on its own and V4's "no gaps" cannot be stated per label.
- **Per-config counter (status quo)**: the colliding `SS-001` labels are the reported defect.
- **Silent drop**: saves a UI label but contradicts ADR-0004's stance that silent dropping caused the original bug.
- **Random SNI in identity**: honest about the bytes, but every link carries a fresh nonce, so dedup never fires and the reported defect survives for anyone with the option on.
- **Always ignoring `sni`, with no flag**: works today because generated links write `sni` equal to `host`, but rests on a coincidence — the day an SNI can differ from the routing subdomain, genuinely different links collapse silently.
