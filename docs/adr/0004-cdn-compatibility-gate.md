# 0004 CDN compatibility gate

The generator only ever tested one thing before rewriting a config: whether its transport was in `ALLOWED_TRANSPORTS`. Anything else was emitted into the output verbatim, an invariant written down as V5 ("passthrough bit-identical"). Two defects followed from that shape. A `kcp` config appeared in the output list looking like a generated link, so the passthrough could not be told apart from a result. And `security` was never examined at all, so a REALITY config with an allowed transport was rewritten to `security=tls` while its `pbk`/`sid`/`spx` params survived the param spread — a hybrid link that cannot connect anywhere.

We replace the single transport test with an explicit **compatibility rule**, and replace unconditional passthrough with explicit rejection plus an opt-in.

A config is CDN-compatible when all of the following hold:

- its transport is `ws`, `xhttp`, `grpc` or `httpupgrade`
- its `security` is `none` or `tls` — an allowlist, so an unrecognised value is refused rather than rewritten
- it carries no `flow`, or it carries `flow` together with a real VLESS Encryption value

Nothing is stripped. REALITY-only params (`pbk`, `sid`, `spx`, `pqv`) cannot reach a generated link because REALITY itself is refused, and `flow` is either legitimate or the whole config is refused. The param spread stays untouched.

## The `flow` rule

`flow=xtls-rprx-vision` selects XTLS Vision, which needs the connection to be a TLS/uTLS/REALITY connection directly. In `proxy/vless/outbound/outbound.go` the `vless.XRV` case accepts `*encryption.CommonConn`, `*tls.Conn`, `*tls.UConn` or `*reality.UConn` and otherwise returns `XTLS only supports TLS and REALITY directly for now.` Behind any of our four transports the connection is the transport wrapper, so the error fires — the config is dead before a CDN is involved.

The first branch is why the rule is conditional rather than a flat refusal. `encryption.CommonConn` is the VLESS Encryption path, and the official documentation states: "VLESS Encryption: No underlying transport restrictions. If the underlying transport is not TCP, it only attempts to penetrate Encryption, saving Encryption overhead." Vision over WebSocket behind a CDN is therefore legitimate, provided VLESS Encryption is on.

Stripping `flow` was considered and rejected on evidence rather than taste. `proxy/vless/inbound/inbound.go` rejects an empty client flow against a Vision-configured account with `account [ID] is rejected since the client flow is empty`, and a mismatched one with `account [ID] is not able to use the flow [clientFlow]`. Matching is strict in both directions, so removing `flow` moves the failure from the client to the server rather than repairing anything.

## Passthrough becomes an opt-in

An excluded config is shown as a row carrying the reason it was excluded, and does not reach the output. A checkbox, **off by default**, puts every excluded line's raw text into the output for the mixed-subscription case where the user wants one list back. Off is the default because the surprise this ADR exists to remove is exactly what passthrough-by-default produced.

## Considered Options

- **Keep passthrough unlabelled**: the reported defect. A raw line in the output is indistinguishable from a generated one, and the download file carries no label at all — the row label only lives in the UI.
- **Drop incompatible configs silently**: removes the false positive and replaces it with a false negative. The user watches a line disappear with no account of why.
- **Block generation while any incompatible row is present**: one bad line in a fifty-line paste holds the other forty-nine hostage, for a condition the user often cannot fix.
- **Blocklist `security=reality`**: refuses today's bad value and rewrites tomorrow's. Any future or unrecognised `security` would fall through the filter and be overwritten with `security=tls`, which is this defect reproduced under a new name. The transport test was already an allowlist; `security` now matches it.
- **Strip `flow` instead of refusing**: contradicted by the inbound's strict flow matching, above.
- **Refuse `flow` unconditionally**: kills the legitimate VLESS Encryption case, which the Xray documentation and a maintainer-endorsed VLESSENC + XHTTP + Vision-behind-CDN configuration both describe as working.
- **Checkbox on by default**: preserves the current behaviour and therefore the current surprise. The mixed-subscription user is advanced and knows what they are looking for; the newcomer does not know what to turn off.

## Consequences

- Every input line becomes exactly one row, with a status of `ok`, `incompatible` or `unparsed`. Unparsed lines were previously dropped by a `.filter(Boolean)` with no feedback whatever; they now carry their raw text and a reason.
- Because no line is filtered out, a row's index is its source line's index. Per-row deletion needs no separate provenance layer.
- Rows gain a delete control, and a bulk control deletes all incompatible rows at once. Deletion rewrites the raw-configs textarea and is not undoable, so `rawConfigs` ownership moves from `InputPanel` to `App` and `InputPanel` becomes a controlled component.
- An `incompatible` or `unparsed` row shows no CDN subdomain field. The field was previously rendered and merely disabled, which stated that something was wrong without stating what.
- Five reason messages across en/fa/ru/zh. The `flow` message is deliberately not phrased as a CDN incompatibility: that config fails against any client, and filing it under "not compatible with CDN" would send the user hunting for a CDN fix.
- V1's output-count formula no longer holds when the checkbox is on; V5's unconditional passthrough is replaced by the checkbox; V13's "at least one parsed row" becomes "at least one compatible row", since a parsed-but-incompatible row would otherwise enable Generate and produce an empty output — the exact case V13 was written to prevent.
