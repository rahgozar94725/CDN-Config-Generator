# 0005 Shadowsocks: Xray-native dialect only

Shadowsocks over an allowed transport passes a CDN as well as VLESS does, so `ss://` joins `vless://`, `vmess://` and `trojan://` as an origin config. But `ss://` has two incompatible dialects in the wild, and we accept only one of them.

**Xray-native.** Xray-core implements Shadowsocks itself — `proxy/shadowsocks`, plus `proxy/shadowsocks_2022` built on `github.com/sagernet/sing-shadowsocks` for SIP022; sing-box is not a dependency. Shadowsocks is therefore an ordinary Xray proxy protocol sitting on the shared transport layer, so it takes full `streamSettings`. Panels emit that as query parameters identical to VLESS: 3x-ui's `genShadowsocksLink` sets `params["type"] = streamNetwork`, calls `applyShareNetworkParams` for `ws`/`grpc`/`httpupgrade`/`xhttp`, and calls `applyShareTLSParams` for `security`, `sni`, `alpn`, `fp`, `ech`, `vcn`, `pcs`.

**SIP002 plugin.** The classic form carries the transport inside a single `plugin` query parameter as a backslash-escaped `;`-separated string — `plugin=xray-plugin;mode=websocket;tls;host=example.com;path=/ws`. This is the SIP003 external-plugin route for shadowsocks-libev and shadowsocks-rust clients. `xray-plugin`'s complete flag set is `mode` (websocket / quic / grpc), `host`, `path`, `serviceName`, `tls`, `cert`, `certRaw`, `key`, `mux` and process plumbing; `v2ray-plugin`'s is the same minus `serviceName` and `mux`. There is no ALPN flag, no fingerprint flag, and no SNI flag — `v2ray-plugin` assigns `tls.Config{ServerName: *host}`, so SNI is locked to `host` by construction.

We accept the Xray-native dialect. A link carrying `plugin` is reported as incompatible with its own reason.

## Considered Options

- **Support both dialects**: the plugin form would need its own parse and build path, would cover only two of the four allowed transports, and could express neither ALPN nor fingerprint. Random SNI would be not merely unsupported but structurally impossible: the only way to change SNI is to change `host`, and `host` is simultaneously the WebSocket Host header the CDN routes on. Every generated link is already Xray-flavoured — we write `security=tls`, `insecure=0`, `allowInsecure=0` — so the audience for a plugin-form output is a client that cannot read our output anyway.
- **Reject `ss://` entirely**: refuses a genuinely CDN-capable protocol. With the checkbox from ADR-0004 off, the user's Shadowsocks configs would simply vanish from the result.
- **Treat a plugin-form link as `unparsed`**: it parses fine; what fails is the dialect. Filing it under "not recognised" would tell the user to delete a link that is perfectly valid.

## Consequences

- Shadowsocks needs no dedicated build path. `userinfo` is carried verbatim, so nothing decodes base64 and nothing distinguishes SIP002 from SIP022 — the segment is opaque to us, and only `host:port` and the query string are rewritten.
- An `ss` row behaves exactly like a VLESS row: same compatibility rule, same routing-subdomain derivation, same ALPN × fingerprint multiplication, same random SNI. No branch of the domain model is special-cased for it.
- One additional reason message across en/fa/ru/zh for the plugin dialect, pointing the user at the Xray-native link their panel can produce.
- The Xray documentation for the Shadowsocks inbound says nothing about transports either way; the `network` field it documents concerns Shadowsocks' own UDP forwarding, not `streamSettings`. Support rests on Shadowsocks being an Xray proxy protocol over the shared transport layer, on 3x-ui emitting exactly these links, and on those links being confirmed working through Cloudflare.
