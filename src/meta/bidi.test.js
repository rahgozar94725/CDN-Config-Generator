// A Persian string is an RTL paragraph with Latin runs embedded in it, so a
// correct translation can still render wrong. `docs/agents/persian-style.md`
// states two rules and measures both; this gate turns the mechanically
// decidable one into an assertion, plus the ban on invisible fixes.
//
// Scope, deliberately narrow:
//
//   Enforced — a Latin run must not end on a neutral run that reverses
//   visibly, and no value may carry a bidi control character.
//
//   Not enforced — rule 1 (Latin runs must be contiguous) is not decidable as
//   the doc writes it: the doc measures `لیست IP/دامین CDN` as **ok**, and
//   that string has two Latin runs split by a Persian word, which is exactly
//   what a contiguity check forbids. Nor is the *leading* half of rule 2:
//   the doc measures `دانلود .txt` broken and `…یکی: VLESS…` ok, and both are
//   a two-character neutral stretch sitting in front of a Latin run. What
//   separates them is whether the punctuation belongs to the Latin token or
//   to the Persian sentence, which is meaning, not shape. Both stay with the
//   doc's devtools snippet.
//
// Like the two gates beside it this reads files as text — nothing here mounts
// a component or renders anything.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const faPath = join(root, 'src', 'i18n', 'locales', 'fa.json')

/**
 * Invisible characters the style doc bans by name: unreviewable in a diff,
 * stripped by some editors, and they ride along into text the user copies.
 * Reshape the sentence instead.
 */
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

const LATIN = /[A-Za-z0-9]/

/**
 * Punctuation a Latin token can own — the pieces of a URL, a version, a file
 * extension. Whitespace counts as neutral too (see `isNeutral`): the space
 * after a Latin token is a neutral like any other, and it is what turns a lone
 * sentence period into a two-character run.
 *
 * Everything outside this set ends a run: Persian letters and their own
 * punctuation (`،`, `؛`), brackets, `{`, `}`, `—`. An RTL paragraph already
 * renders those where a Persian reader expects them.
 *
 * A string rather than a regex character class: an unescaped `/` inside a
 * class is legal JS, but Vite's import lexer ends the literal on it and then
 * reports a syntax error at the last line of the file.
 */
const TOKEN_NEUTRAL = '.:/-_?&=#%@~+*!|'

const isNeutral = (ch) => /\s/.test(ch) || TOKEN_NEUTRAL.includes(ch)

/**
 * A neutral stretch of one character is invisible: reversing a single
 * character yields the same character. That is why the doc measures
 * `لیست IP/دامین CDN` as ok and calls the interior slash fine. Two or more
 * reverse visibly — `://` renders `//:`, and a sentence period plus its space
 * lands on the far side of the Latin token it was meant to follow.
 */
const MIRRORS_VISIBLY = 2

/**
 * Each Latin run in `value` with the neutral characters trailing it. A neutral
 * stretch followed by more Latin is *interior*, not trailing, which is why
 * `VLESS:// VMESS:// TROJAN` is one run ending on `N` rather than three runs
 * ending on `/`.
 */
const latinRuns = (value) => {
  const runs = []
  let i = 0
  while (i < value.length) {
    if (!LATIN.test(value[i])) {
      i += 1
      continue
    }
    const start = i
    for (;;) {
      while (i < value.length && LATIN.test(value[i])) i += 1
      const neutralStart = i
      while (i < value.length && isNeutral(value[i])) i += 1
      if (i > neutralStart && i < value.length && LATIN.test(value[i])) continue
      runs.push({ run: value.slice(start, neutralStart), trailing: value.slice(neutralStart, i) })
      break
    }
  }
  return runs
}

/** The offending substrings in `value` — run plus the trailing neutrals that reverse. */
const brokenRuns = (value) =>
  latinRuns(value)
    .filter(({ trailing }) => trailing.length >= MIRRORS_VISIBLY)
    .map(({ run, trailing }) => `${run}${trailing}`)

const controlsIn = (value) =>
  [...new Set(value.match(BIDI_CONTROLS) ?? [])].map(
    (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
  )

const fa = JSON.parse(readFileSync(faPath, 'utf8'))
const entries = Object.entries(fa)

/**
 * The doc's own worked examples, with the verdict it measured. These six are
 * the fixture this gate is calibrated against — the verdicts come from running
 * the devtools snippet in `docs/agents/persian-style.md`, not from reading the
 * rule and agreeing with it.
 */
const WORKED_EXAMPLES = [
  { text: 'دانلود فایل txt', broken: false, why: 'no trailing neutral at all' },
  { text: 'لیست IP/دامین CDN', broken: false, why: 'interior slash is one character, so it reverses to itself' },
  { text: 'هر خط یکی: VLESS:// VMESS:// TROJAN', broken: false, why: 'every :// is interior — Latin follows it' },
  { text: 'دانلود .txt', broken: false, why: 'measured broken, but by the LEADING neutral this gate does not judge' },
  { text: 'VLESS://، VMESS://، TROJAN:// را', broken: true, why: 'the Persian comma ends the run, so :// trails it' },
  { text: 'VLESS:// و VMESS:// و TROJAN', broken: true, why: 'a Persian word ends the run, so :// trails it' },
]

describe('fa.json is free of invisible bidi fixes', () => {
  it('found the file it audits', () => {
    expect(entries.length, 'no keys read from src/i18n/locales/fa.json').toBeGreaterThan(0)
  })

  it('no value carries a bidi control character', () => {
    expect(
      entries.flatMap(([key, value]) => controlsIn(value).map((cp) => `${key} → ${cp}`)),
      'bidi control characters in fa.json — reshape the sentence instead'
    ).toEqual([])
  })

  it('names the code point when one is inserted', () => {
    expect(controlsIn('\u200Eدانلود')).toEqual(['U+200E'])
    expect(controlsIn('\u2066a\u2069')).toEqual(['U+2066', 'U+2069'])
  })
})

describe('every Latin run in fa.json ends on a Latin character', () => {
  it('agrees with every verdict the style doc measured', () => {
    expect(WORKED_EXAMPLES.map(({ text, why }) => `${why}: ${brokenRuns(text).length > 0}`)).toEqual(
      WORKED_EXAMPLES.map(({ broken, why }) => `${why}: ${broken}`)
    )
  })

  it('no value ends a Latin run on punctuation', () => {
    expect(
      entries.flatMap(([key, value]) => brokenRuns(value).map((run) => `${key} → ${run}`)),
      'Latin runs whose trailing punctuation reverses — reshape so the run ends on a letter'
    ).toEqual([])
  })

  it('names the offending run', () => {
    expect(brokenRuns('یعنی VLESS:// را')).toEqual(['VLESS:// '])
    expect(brokenRuns('یا رمزنگاری VLESS. هیچ')).toEqual(['VLESS. '])
  })

  it('leaves a one-character interior neutral alone', () => {
    expect(brokenRuns('لیست IP/دامین CDN')).toEqual([])
    expect(brokenRuns('پورت 8-12 است')).toEqual([])
  })

  it('does not read the RTL sentence punctuation as part of a Latin token', () => {
    expect(brokenRuns('نباشد (آدرس IP)، این فیلد')).toEqual([])
    expect(brokenRuns('{count} کانفیگ تولید شد')).toEqual([])
  })
})
