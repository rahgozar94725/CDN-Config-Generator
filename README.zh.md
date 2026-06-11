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

## 技术栈

- Vue 3 + Vite + Tailwind CSS + vue-i18n
- Vitest 单元测试
- 单页应用（无 SSR）

## 开发

```bash
npm install
npm run dev     # 开发服务器
npm run build   # 生产构建
npm test        # 运行测试
```

## 许可

MIT
