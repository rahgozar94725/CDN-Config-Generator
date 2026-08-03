# 0001 CDN subdomain field

> Refined by [ADR-0003](0003-cdn-subdomain-field-value-semantics.md), which defines what the field's value means (untouched / edited / cleared) and the validity rule it must satisfy. The derivation order below is unchanged.

Generated links must carry a routing subdomain in `host` + `sni`, but the connect address of an origin config may be an IP, and its `sni` is frequently a random bypass value. We introduce a per-config **CDN subdomain field** that holds the routing subdomain, auto-filled and editable, and write it into every generated link's `host` and `sni` parameters.

Derivation order: the origin config's explicit `host` param wins; otherwise a hostname connect address is used; otherwise (IP connect address and no `host` param) the field is required and generation is blocked until it is filled. The input `sni` is deliberately never read, because users commonly set it to a random/FQDN-bypass value unrelated to the routing subdomain.

## Considered Options

- **Reuse `host` param only**: insufficient — many configs carry no `host` param and rely on the connect address being a hostname.
- **Global override field**: breaks multi-config pastes where each config has its own routing subdomain.
- **Lenient fallback to connect address on IP**: silently emits broken links — worse than blocking.
- **Required for every config**: friction for the common case where the value is derivable.

## Consequences

- Per-config UI rows with per-row editing and an apply-to-all action; note on page explaining the derivation rule.
- UI copy must be updated in all bundled languages (en, fa, zh, ru) and the README variants (en, fa, zh, ru).
- `genRandomSni` must extract the root domain from the CDN subdomain field, not the connect address.
- New invariant: every generated link's `host`/`sni` equals the config's CDN subdomain field value.
