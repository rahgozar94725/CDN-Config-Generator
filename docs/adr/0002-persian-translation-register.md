# 0002 Persian translation register

The Persian strings drifted between two registers: transliterated loanwords (`ساب‌دامین`) sitting next to native Persian (`دامنه`), and `نام میزبان` competing with `هاست نیم` for hostname. We standardise on the **transliterated register** used by the Iranian proxy/Xray community — `دامین`، `ساب‌دامین`، `هاست`، `کانفیگ`، `پورت` — because that audience reads `host=` and `sni=` in raw config text daily, and the academic equivalents (`زیردامنه`، `درگاه`) add a translation step for no gain. Digits are ASCII everywhere outside code blocks. Persian is permitted to be more precise than English; where it is, English is corrected rather than left divergent.

## Considered Options

- **Native/academic Persian** (`زیردامنه`، `نام میزبان`، `درگاه`): matches فرهنگستان and formal documentation, but not how the audience speaks.
- **`دامنه` with `ساب‌دامنه`**: `دامنه` is the Iranian hosting-industry default (`ثبت دامنه`) and is internally consistent. Rejected because the sub-audience here is the proxy community, where `دامین` is the live word.
- **Split register** — transliterated UI labels, native Persian prose: nothing tells the reader the two words denote one concept, so it reads as an oversight rather than a rule.
- **Persian-Indic digits** (`۴۴۳`): natural in prose, but ports are values the user types back into a field, and `output.count` / `output.progress` interpolate ASCII from JS. Any static-Persian rule leaves adjacent UI strings disagreeing with each other.
- **Persian mirrors English exactly**: prevents divergence, but propagates English defects — `randomSniHint` said "host" where `genRandomSni` uses the root domain.

## Consequences

- `هاست` renders both **hostname** and (as `هاست CDN`) **CDN host**. Every lone **hostname** mention must contrast it with IP in the same sentence, because bare `هاست` does not carry "not an IP".
- `CONTEXT.md` holds the term table; `docs/agents/persian-style.md` holds the operational rules. The ADR is not the place to look up how to spell a compound.
- English is in scope during a Persian pass whenever Persian exposes an English defect. `en.json` and `README.md` may change.
- RTL constrains string *shape*, not just wording — a correct translation can still render wrong. See the bidi rules in the style guide.
- `README.ru.md` and `README.zh.md` still carry the stale `host`/`sni` claim that was corrected in en/fa. Left for a follow-up that has native review.
