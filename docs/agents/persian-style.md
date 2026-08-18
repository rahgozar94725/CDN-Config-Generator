# Persian Style

Rules for editing `src/i18n/locales/fa.json` and `README.fa.md`.
Terms live in `CONTEXT.md`. The reasoning behind the register lives in `docs/adr/0002-persian-translation-register.md`.

## Register

Transliterated network vocabulary, not academic Persian.

- `دامین` — not `دامنه`
- `ساب‌دامین` — not `زیردامنه`
- `هاست` — not `نام میزبان`, not `هاست نیم`
- `کانفیگ`، `پورت`، `پوسته`

`هاست` is overloaded: it renders both **hostname** and, as `هاست CDN`, **CDN host**. When you mean *hostname*, the sentence must contrast it with IP — `وقتی به‌جای IP یک هاست باشد`. Bare `هاست` does not carry "not an IP" on its own.

## Orthography

Compounds attach with نیم‌فاصله (ZWNJ). Verbs stay split.

| kind | write | not |
|---|---|---|
| agent noun | `تولیدکننده`، `تکثیرکننده`، `غیرمسدودکننده` | `تولید کننده` |
| participle **adjective** | `تولیدشده`، `پشتیبانی‌شده` | `تولید شده` |
| participle **verb** | `تولید شد`، `پیکربندی شده باشد` | `تولیدشد` |
| compound adjective | `تک‌صفحه‌ای`، `چندزبانه` | `تک صفحه‌ای` |
| adverbial | `به‌صورت`، `به‌جای` | `به صورت` |
| plural | `ردیف‌ها` | `ردیفها` |

The adjective/verb split is the one that looks wrong: `کانفیگ‌های تولیدشده` and `{count} کانفیگ تولید شد` sit next to each other in the output panel with different spacing. Both are correct.

## Digits

ASCII everywhere outside code blocks — `443`, `80`, `8-12`, `2 لینک`.

Not a style preference: ports are values the user types back into a field, and `output.count` / `output.progress` interpolate ASCII from JS. Persian-Indic digits in static strings would leave adjacent UI strings disagreeing.

## RTL / bidi

`dir="rtl"` is set document-wide for `fa` (`src/i18n/index.js`). Persian strings are an RTL paragraph with Latin runs embedded, so **a correct translation can still render wrong**. Two rules, both measured (see below):

1. **Latin runs must be contiguous.** Separating Latin tokens with a Persian word or `،` reverses their visual order, and breaks the `://` on *every* separated token — not just the last.
2. **A Latin run must end on a Latin letter**, never on `://`, `.`, or other punctuation. A trailing neutral run mirrors (`://` → `//:`) and relocates to the opposite edge of the line. End-of-string does not save it.

Worked examples:

```
دانلود .txt                          renders  txt. دانلود              broken
دانلود فایل txt                      renders  txt فایل دانلود          ok
لیست IP/دامین CDN                    renders  CDN دامین/IP لیست        ok — interior slash is fine
…VLESS://، VMESS://، TROJAN:// را…   renders  //:VLESS://، VMESS://، TROJAN…   broken
…VLESS:// و VMESS:// و TROJAN…       breaks BOTH schemes                       worse
…هر خط یکی: VLESS:// VMESS:// TROJAN                                           ok
```

Do **not** fix bidi with invisible characters (U+200E, U+2068/U+2069). They are unreviewable in diffs, get stripped by editors, and ride along into copied text. Reshape the string instead.

Rule 2 is enforced. `src/meta/bidi.test.js` fails the suite when a `fa.json` value ends a Latin run on punctuation that reverses visibly, and when a value carries a bidi control character. The worked examples above are the gate's own fixture, so a change to a verdict here has to be a change to a measurement.

Two things the gate deliberately does not judge, because neither is decidable from the shape of the string:

- Rule 1. `لیست IP/دامین CDN` is measured **ok** and has two Latin runs split by a Persian word, which is what a contiguity check forbids.
- The *leading* half of rule 2. `دانلود .txt` is measured broken and `…یکی: VLESS…` measured ok, and both are a two-character neutral stretch in front of a Latin run. What separates them is whether the punctuation belongs to the Latin token or to the Persian sentence — meaning, not shape.

Both stay with the snippet below.

`README.fa.md` is exempt: GitHub renders Markdown in an LTR paragraph, so Latin runs there are not at risk. These rules are about the app.

## Verifying a string before you ship it

The gate covers rule 2's trailing half. For the two cases above it does not judge, load the app and measure visual order rather than eyeballing a screenshot:

```js
// paste in devtools; returns the visual left-to-right order of each string
(strings => {
  const host = document.createElement('div')
  host.setAttribute('dir', 'rtl')
  host.style.cssText = 'position:absolute;top:0;left:0;width:3000px;white-space:pre'
  document.body.appendChild(host)
  const out = {}
  for (const [key, s] of Object.entries(strings)) {
    const span = document.createElement('span')
    span.textContent = s
    host.appendChild(span)
    const items = []
    for (let i = 0; i < s.length; i++) {
      const r = document.createRange()
      r.setStart(span.firstChild, i); r.setEnd(span.firstChild, i + 1)
      const rect = r.getBoundingClientRect()
      if (rect.width || rect.height) items.push({ ch: s[i], x: rect.left })
    }
    out[key] = items.sort((a, b) => a.x - b.x).map(i => i.ch).join('')
    host.removeChild(span)
  }
  document.body.removeChild(host)
  return out
})({ candidate: 'your string here' })
```

Persian reads right-to-left, so the output looks reversed — that is expected. What you are checking is whether Latin tokens and their punctuation stayed together.

## English is in scope

Where Persian exposes a defect in the English source, fix the English too rather than leaving the two divergent. `randomSniHint` said "host" where `genRandomSni` uses the root domain; both were corrected.
