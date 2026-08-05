# CDN Config Generator

Generates per-CDN-node proxy links from one or more original proxy configs. The original connect address is replaced by each CDN node, while the CDN routing identity is preserved from the original config.

## Language

**Origin config**:
A pasted proxy link (vless/vmess/trojan/ss) that the generator starts from.
"Raw config" is the accepted user-facing label (the UI input is named Raw Configs); origin config is the canonical term.
_Avoid_: Source config

**Compatible config**:
An origin config the CDN method can carry: its transport is one the CDN passes, its transport security is plain or ordinary TLS, and any flow it declares is one that survives off raw TCP. Only a compatible config becomes generated links.
_Avoid_: Valid config, supported config

**Incompatible config**:
An origin config that parsed cleanly but the CDN method cannot carry. Distinct from an unparsed line: nothing is wrong with the text, the config simply cannot reach a CDN in this shape. Always carries a reason, because the remedies differ — a refused transport is the server's to change, while a flow declared without VLESS Encryption is a config that no client accepts at all, CDN or not.
_Avoid_: Invalid config, bad config, unsupported protocol

**Unparsed line**:
An input line that is not a recognised proxy link at all — an unknown scheme, or plain text. Kept as a row rather than discarded, so that a line the user pasted never vanishes without account.
_Avoid_: Garbage, malformed config

**Row status**:
Which of the three kinds a row is: compatible, incompatible, or unparsed. Every input line is exactly one row, so a row's position is its line's position.
_Avoid_: Row type, row state

**Passthrough**:
Emitting an excluded row's raw text into the output unchanged. Opt-in and off by default: it serves the mixed subscription a user wants returned as one list, and it is the behaviour that once made an untouched link indistinguishable from a generated one.
_Avoid_: Copy through, unchanged output

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

**Vision flow**:
The `flow` value that selects XTLS Vision. It needs the connection to be a TLS or REALITY connection directly, which no CDN-passing transport gives it — unless VLESS Encryption carries it instead. Never removed from a config to make it fit: the server matches the client's flow exactly, so removing it moves the failure rather than fixing it.
_Avoid_: XTLS, vision

**VLESS Encryption**:
Protocol-level encryption declared in a config's `encryption`, distinct from transport security. The one thing that makes Vision flow usable away from raw TCP, and therefore the sole reason the flow rule is conditional rather than a flat refusal.
_Avoid_: Encryption, VLESS enc

**ss dialect**:
Which of the two mutually unintelligible ways an `ss` link states its transport. The **Xray-native** dialect states it in query parameters exactly as VLESS does; the **plugin dialect** packs it into a single escaped `plugin` parameter and can express neither ALPN, nor fingerprint, nor an SNI distinct from the routing subdomain. Only the Xray-native dialect is accepted.
_Avoid_: SS format, SIP002

**userinfo**:
The credential segment of an `ss` link, between the scheme and the connect address. Deliberately opaque: it is carried into generated links verbatim, so its encoding is never a question the generator has to answer.
_Avoid_: Password, credentials

**Link identity**:
The set of properties that make two output links interchangeable for a client: the query key=value set (compared order-insensitively), plus address, port, security, transport, and any other link-shaping fields — excluding the remark. Two links with equal identity are one link, whatever their byte order.
_Avoid_: Dedup key, fingerprint, equality

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
| Compatible config | کانفیگ سازگار |
| Incompatible config | کانفیگ ناسازگار |
| Unparsed line | خط ناشناخته |
| Row status | وضعیت ردیف |
| Passthrough | عبور دست‌نخورده |
| transport | ترنسپورت |
| Vision flow | فلوی Vision |
| VLESS Encryption | رمزنگاری VLESS |
| ss dialect | گویش ss |
| userinfo | بخش اعتبارنامه |

`هاست` renders both **CDN host** (as «هاست CDN») and **hostname**. Where **hostname**
appears alone, the surrounding sentence must contrast it with IP, since bare «هاست»
does not carry "not an IP" on its own.
