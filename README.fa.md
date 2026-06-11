# تولید کننده کانفیگ CDN

**تکثیر کننده کانفیگ Xray و تولید کننده لینک CDN**

[English](README.md) | [Русский](README.ru.md) | [中文](README.zh.md)

یک SPA تحت مرورگر که کانفیگ‌های خام Xray (VLESS / VMESS / Trojan) را دریافت کرده و با ترکیب IPهای CDN، پورت‌ها و تنظیمات TLS، لیست گسترده‌ای از لینک‌های آماده استفاده تولید می‌کند.

## قابلیت‌ها

- **ورودی:** چسباندن کانفیگ‌های خام و لیست IP/دامنه CDN
- **تغییر حالت TLS / بدون TLS** — هر دو حالت با انتخاب پورت مستقل
- **تنظیمات پیشرفته TLS:**
  - انتخاب چندگانه ALPN (h3, h2, http/1.1 و ترکیبات)
  - انتخاب چندگانه Fingerprint (chrome, firefox, safari, edge, android, random, randomized)
  - SNI تصادفی (۸-۱۲ کاراکتر تصادفی + دامنه اصلی + نقطه پایان)
- **خروجی:** کپی همه در کلیپ‌بورد یا دانلود به صورت `.txt`
- **Theme انتخابی:** روشن / تاریک / سیستمی
- **چند زبانه:** انگلیسی، فارسی، روسی، چینی — پشتیبانی از RTL برای فارسی
- **غیر مسدود کننده:** نوار پیشرفت در حین تولید، بدون هنگ کردن مرورگر

## نحوه استفاده

### 1. ورودی کانفیگ‌های خام

لینک‌های کانفیگ Xray را در فیلد **Raw Configs** وارد کنید، هر خط یک لینک. فرمت‌های پشتیبانی شده:

```
vless://uuid@example.com:443?type=ws&security=tls&path=%2F#my-server
trojan://password@example.com:443?type=ws&security=tls&sni=sni.example.com#trojan-box
vmess://eyJ2IjoiMiIsInBzIjoibSIsImFkZCI6...
```

**توجه:** فقط کانفیگ‌هایی با transport type `ws`، `xhttp`، `httpupgrade` یا `grpc` پردازش می‌شوند. سایر transportها بدون تغییر عبور می‌کنند.

### 2. ورودی لیست CDN

آدرس‌های IP یا دامنه‌های CDN را در فیلد **CDN List** وارد کنید، هر خط یک مورد:

```
1.1.1.1
2.2.2.2
cdn.example.com
```

### 3. تنظیمات

- **TLS / بدون TLS:** هر کدام را روشن/خاموش کنید. حداقل یکی باید فعال باشد.
- **پورت‌ها:** برای هر حالت فعال، پورت‌ها را انتخاب کنید (پیش‌فرض بدون TLS: ۸۰، TLS: ۴۴۳). حداقل یک پورت برای هر حالت فعال الزامی است.
- **تنظیمات پیشرفته TLS (وقتی TLS فعال است):**
  - **ALPN:** یک یا چند پروتکل انتخاب کنید (h3, h2, http/1.1 یا ترکیبات). حداقل یکی الزامی است.
  - **Fingerprint:** یک یا چند fingerprint انتخاب کنید (chrome, firefox, safari, edge, android, random, randomized). حداقل یکی الزامی است.
  - **SNI تصادفی:** با فعال‌سازی، SNI با ۸-۱۲ کاراکتر تصادفی + دامنه اصلی + نقطه پایان جایگزین می‌شود (عبور FQDN).

### 4. تولید

روی **Generate** کلیک کنید. نوار پیشرفت وضعیت پردازش را نشان می‌دهد. مرورگر هنگ نمی‌کند.

### 5. خروجی

- **Copy All:** همه لینک‌های تولید شده را در کلیپ‌بورد کپی می‌کند.
- **Download .txt:** همه لینک‌ها را به صورت فایل `.txt` ذخیره می‌کند.

### مثال

**ورودی (کانفیگ خام):**
```
vless://a1b2c3d4@shop.ir:443?type=ws&security=tls&path=%2Fconnect#cdn-node
```

**لیست CDN:**
```
1.1.1.1
2.2.2.2
```

**تنظیمات:** TLS روشن، پورت ۴۴۳، ALPN: h2، Fingerprint: chrome، SNI تصادفی: خاموش

**خروجی تولید شده (۲ لینک):**
```
vless://a1b2c3d4@1.1.1.1:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-001
vless://a1b2c3d4@2.2.2.2:443?type=ws&security=tls&path=%2Fconnect&host=shop.ir&sni=shop.ir&alpn=h2&fp=chrome&insecure=0&allowInsecure=0#cdn-node-002
```

## تکنولوژی

- Vue 3 + Vite + Tailwind CSS + vue-i18n
- Vitest برای تست‌های واحد
- برنامه تک صفحه‌ای (بدون SSR)

## توسعه

```bash
npm install
npm run dev     # سرور توسعه
npm run build   # ساخت نسخه نهایی
npm test        # اجرای تست‌ها
```

## مجوز

MIT
