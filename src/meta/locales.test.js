// The four locale files are only a translation set while they agree on what
// they translate. This gate fails the suite when a key exists in one file and
// not another, when a value is not a usable string, when a key exists in all
// four but nothing under `src/` renders it, and when `src/` renders a key no
// locale file defines.
//
// Like the traceability gate beside it, this is a string check over files read
// from disk: nothing here imports a component or mounts anything, so a locale
// key is checked for the price of reading ~30 small files.
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const localeDir = join(root, 'src', 'i18n', 'locales')
const themeModule = join(root, 'src', 'theme', 'index.js')

const read = (path) => readFileSync(path, 'utf8')

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )

/** Every string that appears quoted in the source — `'a.b'`, `"a.b"`, `` `a.b` ``. */
const quotedStrings = (source) => [...source.matchAll(/['"`]([\w.]+)['"`]/g)].map((m) => m[1])

/**
 * Prefixes of a key built at runtime: the literal half of `t('theme.' + x)` or
 * of ``t(`theme.${x}`)``. A key starting with one of these never appears whole
 * in the source, so the gate has to compose the live set itself.
 */
const dynamicPrefixes = (source) => [
  ...[...source.matchAll(/\$?t\(\s*['"`]([\w.]*)['"`]\s*\+/g)].map((m) => m[1]),
  ...[...source.matchAll(/\$?t\(\s*`([\w.]*)\$\{/g)].map((m) => m[1]),
]

/** The names in `const themes = [...]`, read from `src/theme/index.js`. */
const themeNamesIn = (source) =>
  [
    ...(source.match(/const themes\s*=\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/['"]([\w-]+)['"]/g),
  ].map((m) => m[1])

/**
 * The keys `ThemeSwitcher.vue:9` composes as `$t('theme.' + t)` — exactly one
 * per theme the module offers, and no more. Exempting the whole `theme.`
 * prefix instead would let `theme.auto` ship dead and pass forever.
 */
const composedThemeKeys = (names) => names.map((name) => `theme.${name}`)

/** `key → the files it is missing from`, for every key not in all of them. */
const parityGaps = (locales) => {
  const names = Object.keys(locales)
  const union = [...new Set(names.flatMap((name) => locales[name]))].sort()
  return union
    .filter((key) => names.some((name) => !locales[name].includes(key)))
    .map((key) => `${key} → missing from ${names.filter((n) => !locales[n].includes(key)).join(', ')}`)
}

/**
 * Why a value cannot be rendered as-is, or `null`. Parity compares key sets
 * only, so without this an empty string, a padded one, or a nested object all
 * pass — and a nested one additionally throws a bare `TypeError` out of the
 * bidi gate, which is a worse way to learn about it.
 */
const valueFault = (value) => {
  if (typeof value !== 'string') return `not a string (${Array.isArray(value) ? 'array' : typeof value})`
  if (value.trim() === '') return 'empty'
  if (value !== value.trim()) return 'padded with whitespace'
  return null
}

/** `file → key → fault`, for every value in every locale that is not usable. */
const valueFaults = (parsed) =>
  Object.entries(parsed).flatMap(([name, entries]) =>
    Object.entries(entries)
      .map(([key, value]) => [key, valueFault(value)])
      .filter(([, fault]) => fault)
      .map(([key, fault]) => `${name}.json → ${key} → ${fault}`)
  )

/**
 * Keys that appear nowhere. The rule is deliberately loose: a key quoted
 * *anywhere* in a non-test source file counts as live, including inside a
 * comment, because `ConfigRows.vue:116` reaches its keys through a lookup table
 * rather than a `t(...)` call and a `t(`-only scan would report all eight
 * `rows.*Error` keys as dead. The cost of the loose rule is a key kept alive by
 * a stale mention; the cost of the tight one was eight false alarms on day one.
 */
const orphans = (keys, live) => keys.filter((key) => !live.includes(key))

/**
 * The reverse of `orphans`: strings the source renders that read as a locale
 * key — first segment is a namespace `en.json` itself defines — but that no
 * locale file has. `$t('rows.typoError')` passes every other gate here and puts
 * the raw key on screen. The namespace set is derived from `en.json` rather
 * than listed, so a new namespace is covered the day it is added.
 *
 * Two kinds of string are namespace-shaped without being keys: the literal half
 * of a composed call (`'theme.'`), and a module named after a namespace
 * (`` `rows.js` `` in a comment). Both exclusions are derived too — from the
 * prefixes found in the source and the filenames found on disk.
 */
const unknownKeys = (quoted, keys, prefixes, fileNames) => {
  const namespaces = new Set(keys.map((key) => key.split('.')[0]))
  return [
    ...new Set(
      quoted.filter(
        (text) =>
          text.includes('.') &&
          namespaces.has(text.split('.')[0]) &&
          !keys.includes(text) &&
          !prefixes.includes(text) &&
          !fileNames.includes(text)
      )
    ),
  ].sort()
}

const localeNames = readdirSync(localeDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))

const parsed = Object.fromEntries(
  localeNames.map((name) => [name, JSON.parse(read(join(localeDir, `${name}.json`)))])
)
const locales = Object.fromEntries(Object.entries(parsed).map(([name, entries]) => [name, Object.keys(entries)]))

const srcFiles = walk(join(root, 'src'))
// Call sites only: the locale files are not their own call sites, and a key
// rendered nowhere but a test is still a key nothing renders.
const callSites = srcFiles.filter((path) => !path.startsWith(localeDir) && !path.endsWith('.test.js'))
const source = callSites.map(read).join('\n')
const quoted = quotedStrings(source)
const prefixes = [...new Set(dynamicPrefixes(source))]
const fileNames = [...new Set(srcFiles.map((path) => basename(path)))]
const themeNames = themeNamesIn(read(themeModule))
const live = [...quoted, ...composedThemeKeys(themeNames)]

describe('locale files agree on their key set', () => {
  // Without this, a renamed directory would leave every list below empty and
  // the gate would pass by having nothing left to compare.
  it('found the files it audits', () => {
    expect(localeNames.length, 'no .json files in src/i18n/locales').toBeGreaterThan(1)
    expect(callSites.length, 'no call sites found under src/').toBeGreaterThan(0)
    expect(quoted.length, 'no quoted strings found in the call sites').toBeGreaterThan(0)
    expect(themeNames.length, 'no `const themes = [...]` names read from src/theme/index.js').toBeGreaterThan(0)
  })

  it('every key is in every locale file', () => {
    expect(parityGaps(locales), 'keys present in some locale files and not others').toEqual([])
  })

  it('names the key and the files missing it when one file gains a key alone', () => {
    expect(parityGaps({ en: ['a', 'b'], fa: ['a'], ru: ['a'], zh: ['a', 'b'] })).toEqual([
      'b → missing from fa, ru',
    ])
  })

  it('every value is a usable string', () => {
    expect(valueFaults(parsed), 'locale values that cannot be rendered as they stand').toEqual([])
  })

  it('names an empty, padded or nested value', () => {
    expect(valueFaults({ en: { a: 'ok', b: '', c: ' padded', d: { e: 'nested' } } })).toEqual([
      'en.json → b → empty',
      'en.json → c → padded with whitespace',
      'en.json → d → not a string (object)',
    ])
  })
})

describe('every locale key is rendered somewhere', () => {
  it('the set of runtime-composed key prefixes is the one this gate composes keys for', () => {
    expect(prefixes.sort(), 'a new `t(prefix + x)` call — compose its live key set the way theme. is').toEqual([
      'theme.',
    ])
  })

  it('no key is unreferenced by src/', () => {
    expect(
      orphans(locales.en, live),
      'locale keys nothing under src/ renders — delete them from all four files'
    ).toEqual([])
  })

  it('reports a key under a composed prefix that no theme composes', () => {
    expect(
      orphans(['theme.light', 'theme.auto'], composedThemeKeys(['light', 'dark', 'system']))
    ).toEqual(['theme.auto'])
  })

  it('reads the theme names out of the module rather than assuming them', () => {
    expect(themeNamesIn("const themes = ['light', 'dark', 'system']\n")).toEqual([
      'light',
      'dark',
      'system',
    ])
    expect(themeNamesIn('no themes here')).toEqual([])
  })

  it('names a key that is in every file and rendered by none', () => {
    expect(orphans(['a.used', 'a.unused'], ['a.used'])).toEqual(['a.unused'])
  })
})

describe('every key src/ renders is in the locale files', () => {
  it('no rendered key is undefined', () => {
    expect(
      unknownKeys(quoted, locales.en, prefixes, fileNames),
      'src/ renders these keys and no locale file defines them — they show as the raw key'
    ).toEqual([])
  })

  it('names a key the source renders and no locale file defines', () => {
    expect(unknownKeys(['rows.title', 'rows.typoError'], ['rows.title'], [], [])).toEqual([
      'rows.typoError',
    ])
  })

  it('ignores strings outside every locale namespace', () => {
    expect(unknownKeys(['node.fs', 'plain'], ['rows.title'], [], [])).toEqual([])
  })

  it('ignores a composed prefix and a module named after a namespace', () => {
    expect(unknownKeys(['rows.', 'rows.js'], ['rows.title'], ['rows.'], ['rows.js'])).toEqual([])
  })
})
