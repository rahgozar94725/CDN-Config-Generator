# CDN Config Generator

Generates per-CDN-node proxy links from one or more original proxy configs. The original connect address is replaced by each CDN node, while the CDN routing identity is preserved from the original config.

## Language

**Origin config**:
A pasted proxy link (vless/vmess/trojan) that the generator starts from.
"Raw config" is the accepted user-facing label (the UI input is named Raw Configs); origin config is the canonical term.
_Avoid_: Source config

**Connect address**:
The host portion of the origin config's URL — where a client would connect without a CDN. May be an IP or a hostname.
_Avoid_: Domain, host, address of origin

**Routing subdomain**:
The subdomain the CDN is configured to route to the origin server. Written into the generated link as both the `host` and `sni` parameters. Always a hostname of at least two labels; never an IP, never carrying a trailing dot, never a non-ASCII or punycode name.
_Avoid_: Domain, SNI host, CDN hostname

**Trailing dot**:
The dot that ends a fully qualified name (`example.com.`). An artefact of the generated `sni` alone — random SNI appends it — and never part of a routing subdomain, so it is rejected in the CDN subdomain field and never appears in `host`.
_Avoid_: Final dot, root dot

**FQDN bypass**:
Emitting the routing identity as a fully qualified name, trailing dot included, so that filtering keyed on the bare name does not match it. Reachable only by turning on random SNI.
_Avoid_: Dot trick

**CDN host**:
An edge node (IP or domain) from the CDN list that replaces the connect address in generated links.
_Avoid_: CDN, node

**CDN list**:
The one-per-line list of CDN hosts applied to every origin config.
_Avoid_: Node list, host list

**host param**:
The explicit routing identity already present in the origin config's query string.
_Avoid_: Host field

**sni param**:
The TLS Server Name Indication value in the origin config. Deliberately ignored on input — users commonly set it to a random/bypass value unrelated to the routing subdomain.
_Avoid_: SNI

**CDN subdomain field**:
The per-config user-facing input that holds the routing subdomain. It has three states: **untouched**, filled by the derived routing subdomain; **edited**, holding the user's own value; and **cleared**, deliberately empty because the user rejected the derived value. Editing and clearing both persist when the origin configs are re-parsed, and both are reversible by resetting the row. Whatever the field ends up holding must be a valid routing subdomain, whether the user typed it or it was derived.
_Avoid_: Domain field

**hostname**:
A connect address that is a host name rather than an IP.
_Avoid_: Domain name

## Persian (فارسی)

Canonical Persian renderings. UI (fa.json) and README.fa.md must use these.
For register, orthography and RTL rules, see `docs/agents/persian-style.md`.

| Term | فارسی |
|---|---|
| Origin config | کانفیگ خام |
| Connect address | آدرس اتصال |
| hostname | هاست |
| Routing subdomain | ساب‌دامین مسیریابی |
| CDN host | هاست CDN |
| CDN list | لیست CDN |
| CDN subdomain field | ساب‌دامین CDN |
| host param | پارامتر host |
| sni param | پارامتر SNI |
| domain | دامین |
| root domain | دامین ریشه |
| trailing dot | نقطه انتهایی |
| FQDN bypass | دور زدن FQDN |
| theme | پوسته |

`هاست` renders both **CDN host** (as «هاست CDN») and **hostname**. Where **hostname**
appears alone, the surrounding sentence must contrast it with IP, since bare «هاست»
does not carry "not an IP" on its own.
