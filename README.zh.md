# CDN 配置生成器

**Xray 配置倍增器和 CDN 链接生成器**

[English](README.md) | [فارسی](README.fa.md) | [Русский](README.ru.md)

一个基于浏览器的单页应用，接收原始 Xray 配置（VLESS / VMESS / Trojan / Shadowsocks），通过 CDN IP、端口和 TLS 设置进行倍增，生成扩展的即用链接列表。

**在线演示：** [https://rahgozar94725.github.io/CDN-Config-Generator/](https://rahgozar94725.github.io/CDN-Config-Generator/)

## 功能

- **输入：** 粘贴原始配置和 CDN IP/域名列表
- **CDN 子域名字段：** 每个配置的路由子域名，自动填充并可编辑，支持全部应用
- **兼容性检查：** 无法通过 CDN 的配置会列出原因、不进入输出，并可逐个或一次性删除
- **TLS / 非 TLS 切换** — 两种模式均可独立选择端口
- **TLS 高级设置：**
  - ALPN 多选（h3, h2, http/1.1 及组合）
  - 指纹多选（chrome, firefox, safari, edge, android, random, randomized）
  - 随机 SNI（8-12 个随机字符 + 根域名 + 尾随点，FQDN 绕过）
- **输出：** 全部复制到剪贴板或下载为 `.txt`
- **主题选择：** 浅色 / 深色 / 系统
- **多语言：** 英语、فارسی（波斯语）、Русский（俄语）、中文 — 支持波斯语 RTL
- **非阻塞：** 生成时显示进度条，浏览器不卡顿

## 使用方法

### 1. 输入原始配置

在 **Raw Configs** 字段中粘贴 Xray 配置链接，每行一个。支持的格式：

```
vless://uuid@example.com:443?type=ws&security=tls&path=%2F#my-server
trojan://password@example.com:443?type=ws&security=tls&sni=sni.example.com#trojan-box
vmess://eyJ2IjoiMiIsInBzIjoibSIsImFkZCI6...
ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@example.com:443?type=ws&security=tls#ss-box
```

**哪些配置能通过 CDN。** 只有同时满足以下三点，配置才会被改写：

- 传输方式为 `ws`、`xhttp`、`grpc` 或 `httpupgrade`
- 传输安全为 `none` 或 `tls` —— REALITY 无法通过 CDN
- 不带 `flow`，或带 `flow` 的同时启用了 VLESS Encryption

其余配置会显示一行说明被排除的原因，并且不会进入输出。每行都有删除按钮，另有
一个按钮可一次删除所有被排除的行。如果你粘贴的是混合订阅并希望原样保留那些行，
请开启 **在输出中包含被排除的配置**。

Shadowsocks 按 Xray 原生格式读取，即传输方式写在查询字符串中，与 VLESS 相同。
不支持较早的 `plugin=` 形式：它无法携带 ALPN 或指纹，且其 SNI 被固定为路由子域名。

### 2. 输入 CDN 列表

在 **CDN List** 字段中输入 CDN IP 地址或域名，每行一个：

```
1.1.1.1
2.2.2.2
cdn.example.com
```

**重要提示：** 您输入的 CDN 主机必须能够代理您路由子域名的流量。生成的链接将原始地址替换为 CDN 主机，并将 CDN 子域名字段的值写入 `host` 参数——因此 CDN 必须配置为将该子域名的请求路由到您的源服务器。

### 3. CDN 子域名

粘贴配置后，每个兼容的配置会显示为一行，带有一个 **CDN 子域名** 字段；被排除的行则显示其原因而非该字段。此字段保存路由标识，写入生成链接的 `host` 参数，并在启用 TLS 时一并写入 `sni`——CDN 使用此值将流量路由到您的源服务器。

**自动填充顺序：**
1. 原始配置中的显式 `host` 参数（优先）
2. 连接地址（如果是主机名，非 IP）
3. 否则为空——您必须手动填写

**必填字段：** 当连接地址是 IP 且没有 `host` 参数时，字段为空，生成将被阻止并显示每行错误。请输入路由子域名（例如 `sub.example.com`）以继续。

**全部应用：** 使用全部应用输入框，一键将所有行填充为相同值。

### 4. 配置设置

- **TLS / 非 TLS：** 分别开关每种模式。至少一种模式必须启用。
- **端口：** 为每种启用的模式选择端口（非 TLS 默认：80；TLS 默认：443）。每种模式至少选择一个端口。
- **TLS 高级设置（TLS 启用时）：**
  - **ALPN：** 选择一个或多个协议（h3、h2、http/1.1 或组合）。至少选择一个。
  - **指纹：** 选择一个或多个指纹（chrome、firefox、safari、edge、android、random、randomized）。至少选择一个。
  - **随机 SNI：** 启用后，SNI 将被替换为 8-12 个随机字符 + 根域名 + 尾随点（FQDN 绕过）。
- **在输出中包含被排除的配置：** 默认关闭，因此输出中只有生成的链接。开启后，每个被排除行的原文将原样复制到输出中。

### 5. 生成

点击 **Generate**。进度条显示处理进度。浏览器不会卡顿。

### 6. 输出

- **Copy All：** 将所有生成的链接复制到剪贴板。
- **Download .txt：** 将所有链接保存为 `.txt` 文件。

### 示例

**输入（原始配置）：**
```
vless://a1b2c3d4@shop.ir:443?type=ws&security=tls&path=%2Fconnect#cdn-node
```

**CDN 列表：**
```
1.1.1.1
2.2.2.2
```

**设置：** TLS 开启，端口 443，ALPN: h2，指纹: chrome，随机 SNI: 关闭

**CDN 子域名：** 自动填充为 `shop.ir`（主机名连接地址，无显式 `host` 参数）。

**生成的输出（2 个链接）：**
```
vless://a1b2c3d4@1.1.1.1:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-001
vless://a1b2c3d4@2.2.2.2:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-002
```

## 技术栈

- Vue 3 + Vite + Tailwind CSS + vue-i18n
- Vitest 单元测试
- 单页应用（无 SSR）

## 开发

```bash
git clone https://github.com/rahgozar94725/CDN-Config-Generator.git
cd CDN-Config-Generator
npm install
npm run dev     # 开发服务器
npm run build   # 生产构建
npm test        # 运行测试
```

在浏览器中打开 `http://localhost:5173`。部署时使用任意静态文件服务器托管 `dist/` 文件夹。

## 支持

如果您觉得这个工具有用并希望支持它的开发，请考虑进行捐赠。您的贡献有助于项目持续存在和改进。

**加密货币捐赠：**

<a href="https://nowpayments.io/donation?api_key=d824db3b-fcf7-4ebb-8e3d-297c23cfeee2" target="_blank" rel="noreferrer noopener">
  <img src="https://nowpayments.io/images/embeds/donation-button-black.svg" alt="加密货币捐赠按钮">
</a>

## 许可

MIT
