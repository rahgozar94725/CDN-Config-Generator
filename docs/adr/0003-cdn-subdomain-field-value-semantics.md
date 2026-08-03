# 0003 CDN subdomain field value semantics

ADR-0001 introduced the CDN subdomain field as auto-filled and editable but left the meaning of its value underspecified in two places, and both turned into defects (B5, B6). We now define the field as holding **three** states rather than two — untouched, edited, and cleared — and we hold whatever it resolves to against an explicit validity rule, applied identically to typed and derived values.

**Clearing is rejection, not reset.** Presence of an entry in the override map selects it, including the empty string; only an absent entry re-derives. Previously the resolution keyed on truthiness, which collapsed "the user never touched this" and "the user deliberately emptied this" into one state. The visible consequence was worse than the ambiguity: clearing a derivable field deleted a key that had never been set, so the resolved value did not change, Vue skipped the DOM patch, and the field and the model diverged silently — the screen showed an empty field while generation went ahead with the value the user had just deleted. A cleared field now blocks generation, and a per-row reset restores the derived value, so the state is reversible without being implicit.

**Validity is a rule, not an absence check.** A routing subdomain must be a hostname of at least two labels, ASCII letters/digits/hyphens per label, no trailing dot, not an IP address, and no `xn--` label. The rule applies to the resolved value regardless of where it came from: an unusable `host` param in an origin config produces exactly the link an unusable typed value does, and ADR-0001 already rejected lenient fallbacks on the grounds that silently emitting broken links is worse than blocking.

## Considered Options

- **Clearing restores the derived value** (visibly refilling the field): keeps the user from ever seeing an empty required field, but discards an explicit user action and leaves no way to blank the field to retype it. It is the same "silently guess" shape ADR-0001 rejected for IP connect addresses.
- **Cleared state expires at the next re-parse**: makes empty an exception to the ownership rule B4 established, reintroducing a special case for one particular value.
- **Validate typed values only**: leaves a back door that skips the whole rule, since any invalid value can be smuggled in through the origin config's `host` param.
- **Warn on derived-invalid, block on typed-invalid**: splits the model in two for no gain — the user must correct the value either way.
- **Public Suffix List**: rejects genuinely unusable TLDs, but needs a large data file or a dependency and would also reject valid non-public domains.
- **Normalise instead of reject** (strip trailing dots, lowercase): every normalisation makes a character vanish as it is typed, and stripping a trailing dot in particular discards a deliberate FQDN-bypass intent without telling the user.
- **Accept a trailing dot and make it flow to `host`**: rejected on the domain rule that a trailing dot belongs to `sni` alone, where random SNI puts it.
- **Convert IDN input to punycode**: needs a conversion library for a case that does not occur in this audience; punycode is refused outright instead.

## Consequences

- Configs whose routing subdomain derives to a single label — `vless://uuid@myserver:443` and the like — now block instead of generating. This is a visible behaviour change, not only a bug fix: a single-label name cannot be a CDN routing target, so the previous output was broken anyway.
- Punycode is refused, so IDN routing subdomains cannot be used at all. `xn--` is IANA-reserved as the ACE prefix, so the test cannot produce a false positive on a non-IDN domain.
- Three UI strings across en/fa/ru/zh: a generic invalid message, a trailing-dot message that points the user at Random SNI, and the reset control's label. Distinguishing only the trailing-dot case is deliberate — the remaining reasons are self-evident from looking at the rejected value.
- Case is preserved rather than lowercased, so `Example.COM` reaches the generated link unchanged. Hostnames are case-insensitive, so nothing downstream depends on it.
- Surrounding whitespace survives in the field while typing and is stripped at the generation boundary, the one place it would otherwise reach a link.
- `extractRootDomain` ignores a trailing dot independently of the validation gate. The gate makes the input unreachable through the UI, but a pure function should not depend on a UI gate for correctness.
- `findMissingRoutingSubdomain` became `findInvalidRoutingSubdomain` and returns a reason per row; the `missingRows` prop became `invalidRows`. The old names described emptiness only.
- `routingSubdomainRequired` from the parser is no longer consulted when validating — the resolved value is checked directly — but it is still set, and still describes the derivation outcome.
