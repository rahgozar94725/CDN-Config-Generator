// The four locale files are only a translation set while they agree on what
// they translate. This gate fails the suite when a key exists in one file and
// not another, and when a key exists in all four but nothing under `src/`
// renders it.
//
// Like the traceability gate beside it, this is a string check over files read
// from disk: nothing here imports a component or mounts anything, so a locale
// key is checked for the price of reading ~30 small files.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const localeDir = join(root, 'src', 'i18n', 'locales')

// `ThemeSwitcher.vue:9` renders `$t('theme.' + t)`, so `theme.light` and its
// siblings are live without ever appearing whole in the source. Every prefix
// composed that way is a hole in the orphan check — a key under it can never be
// reported unused — so the set is pinned here rather than merely collected.
// Adding a prefix is allowed; doing it silently is not.
const EXPECTED_DYNAMIC_PREFIXES = ['theme.']

const read = (path) => readFileSync(path, 'utf8')

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )

/** Every string that appears quoted in the source — `'a.b'`, `"a.b"`, `` `a.b` ``. */
const quotedStrings = (source) => [...source.matchAll(/['"`]([\w.]+)['"`]/g)].map((m) => m[1])

/**
 * Prefixes of a key built at runtime: the literal half of `t('theme.' + x)` or
 * of ``t(`theme.${x}`)``. A key starting with one of these cannot be judged
 * unused by reading the source.
 */
const dynamicPrefixes = (source) => [
  ...[...source.matchAll(/\$?t\(\s*['"`]([\w.]*)['"`]\s*\+/g)].map((m) => m[1]),
  ...[...source.matchAll(/\$?t\(\s*`([\w.]*)\$\{/g)].map((m) => m[1]),
]

/** `key → the files it is missing from`, for every key not in all of them. */
const parityGaps = (locales) => {
  const names = Object.keys(locales)
  const union = [...new Set(names.flatMap((name) => locales[name]))].sort()
  return union
    .filter((key) => names.some((name) => !locales[name].includes(key)))
    .map((key) => `${key} → missing from ${names.filter((n) => !locales[n].includes(key)).join(', ')}`)
}

/**
 * Keys that appear nowhere. The rule is deliberately loose: a key quoted
 * *anywhere* in a non-test source file counts as live, including inside a
 * comment, because `ConfigRows.vue:116` reaches its keys through a lookup table
 * rather than a `t(...)` call and a `t(`-only scan would report all eight
 * `rows.*Error` keys as dead. The cost of the loose rule is a key kept alive by
 * a stale mention; the cost of the tight one was eight false alarms on day one.
 */
const orphans = (keys, quoted, prefixes) =>
  keys.filter((key) => !quoted.includes(key) && !prefixes.some((p) => p && key.startsWith(p)))

const localeNames = readdirSync(localeDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))

const locales = Object.fromEntries(
  localeNames.map((name) => [name, Object.keys(JSON.parse(read(join(localeDir, `${name}.json`))))])
)

// Call sites only: the locale files are not their own call sites, and a key
// rendered nowhere but a test is still a key nothing renders.
const callSites = walk(join(root, 'src')).filter(
  (path) => !path.startsWith(localeDir) && !path.endsWith('.test.js')
)
const source = callSites.map(read).join('\n')
const quoted = quotedStrings(source)
const prefixes = [...new Set(dynamicPrefixes(source))]

describe('locale files agree on their key set', () => {
  // Without this, a renamed directory would leave every list below empty and
  // the gate would pass by having nothing left to compare.
  it('found the files it audits', () => {
    expect(localeNames.length, 'no .json files in src/i18n/locales').toBeGreaterThan(1)
    expect(callSites.length, 'no call sites found under src/').toBeGreaterThan(0)
    expect(quoted.length, 'no quoted strings found in the call sites').toBeGreaterThan(0)
  })

  it('every key is in every locale file', () => {
    expect(parityGaps(locales), 'keys present in some locale files and not others').toEqual([])
  })

  it('names the key and the files missing it when one file gains a key alone', () => {
    expect(parityGaps({ en: ['a', 'b'], fa: ['a'], ru: ['a'], zh: ['a', 'b'] })).toEqual([
      'b → missing from fa, ru',
    ])
  })
})

describe('every locale key is rendered somewhere', () => {
  it('the set of runtime-composed key prefixes is the one this gate knows about', () => {
    expect(prefixes.sort(), 'a new `t(prefix + x)` call — add it to EXPECTED_DYNAMIC_PREFIXES').toEqual(
      EXPECTED_DYNAMIC_PREFIXES
    )
  })

  it('no key is unreferenced by src/', () => {
    expect(
      orphans(locales.en, quoted, prefixes),
      'locale keys nothing under src/ renders — delete them from all four files'
    ).toEqual([])
  })

  it('treats a key reached through a composed prefix as live', () => {
    expect(orphans(['theme.light', 'theme.dark'], [], ['theme.'])).toEqual([])
  })

  it('names a key that is in every file and rendered by none', () => {
    expect(orphans(['a.used', 'a.unused'], ['a.used'], [])).toEqual(['a.unused'])
  })
})
