# CDN 配置生成器

**Xray 配置倍增器和 CDN 链接生成器**

[English](README.md) | [فارسی](README.fa.md) | [Русский](README.ru.md)

一个基于浏览器的单页应用，接收原始 Xray 配置（VLESS / VMESS / Trojan），通过 CDN IP、端口和 TLS 设置进行倍增，生成扩展的即用链接列表。

## 功能

- **输入：** 粘贴原始配置和 CDN IP/域名列表
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
```

**注意：** 仅处理传输类型为 `ws`、`xhttp`、`httpupgrade` 或 `grpc` 的配置。其他传输类型保持原样。

### 2. 输入 CDN 列表

在 **CDN List** 字段中输入 CDN IP 地址或域名，每行一个：

```
1.1.1.1
2.2.2.2
cdn.example.com
```

**重要提示：** 您输入的 CDN 主机必须能够代理原始配置中域名的流量。生成的链接将原始地址替换为 CDN 主机，同时保留原始域名在 `host` 和 `sni` 参数中——因此 CDN 必须配置为将您域名的请求路由到您的源服务器。

### 3. 配置设置

- **TLS / 非 TLS：** 分别开关每种模式。至少一种模式必须启用。
- **端口：** 为每种启用的模式选择端口（非 TLS 默认：80；TLS 默认：443）。每种模式至少选择一个端口。
- **TLS 高级设置（TLS 启用时）：**
  - **ALPN：** 选择一个或多个协议（h3、h2、http/1.1 或组合）。至少选择一个。
  - **指纹：** 选择一个或多个指纹（chrome、firefox、safari、edge、android、random、randomized）。至少选择一个。
  - **随机 SNI：** 启用后，SNI 将被替换为 8-12 个随机字符 + 根域名 + 尾随点（FQDN 绕过）。

### 4. 生成

点击 **Generate**。进度条显示处理进度。浏览器不会卡顿。

### 5. 输出

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
