// SPEC.md is a spec only while its rows stay anchored to something that exists.
// This gate fails the suite when a §V invariant has no test carrying its id,
// when a §V id is tagged on a test but no longer has a row, when a §B defect or
// a §T task cites a §V row or an ADR that does not resolve, or when an `ADR-000N`
// mentioned anywhere under `src/` or in SPEC.md names a file that is not in
// `docs/adr/`.
//
// It is a string check over files read from disk, not a run of the suite it
// audits: nothing here imports a module under test, so there is no cycle and no
// cost beyond reading ~30 small files.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// V9 — theme choice persisted to localStorage, `dark` class on <html> matching
// it — is the one invariant with no test. Asserting it needs a DOM harness
// (jsdom + a component mount) that this repo does not install, and inventing
// one is a larger change than this gate. Delete this entry the day such a test
// lands. It is the only exemption the gate grants; every other §V row must be
// tagged.
const UNTESTED_BY_DESIGN = ['V9']

const read = (path) => readFileSync(path, 'utf8')

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )

/** Table rows of one `## §X` section, as the raw `| X<n> | … |` lines. */
const sectionRows = (spec, letter) =>
  (spec.split(/^## §/m).find((section) => section.startsWith(letter)) ?? '')
    .split('\n')
    .filter((line) => new RegExp(`^\\|\\s*${letter}\\d+\\s*\\|`).test(line))

const rowId = (row) => row.match(/^\|\s*([A-Z]\d+)/)[1]

/**
 * Ids from a test name's leading tag: the run of `V<n>` before the first colon.
 * A comma-separated run tags every id in it, so one test can anchor two rows.
 * A tag on a test the runner never executes is not coverage, so `.skip(`,
 * `.todo(` or `.fails(` earlier on the same line drops the tag.
 */
const testTags = (source) =>
  [...source.matchAll(/['"`]((?:V\d+[,\s]*)+):/g)]
    .filter(
      (m) => !/\.(skip|todo|fails)\(/.test(source.slice(source.lastIndexOf('\n', m.index) + 1, m.index))
    )
    .flatMap((m) => m[1].match(/V\d+/g))

const adrNumbers = (source) => [...new Set([...source.matchAll(/ADR-(\d{4})/g)].map((m) => m[1]))]

const spec = read(join(root, 'SPEC.md'))
const invariants = sectionRows(spec, 'V').map(rowId)
const defects = sectionRows(spec, 'B')
const tasks = sectionRows(spec, 'T')

/** `<row id> → <cited id>` for each V-id a row cites that has no §V row. */
const unresolvedCitations = (rows) =>
  rows.flatMap((row) =>
    (row.match(/\bV\d+\b/g) ?? [])
      .filter((id) => !invariants.includes(id))
      .map((id) => `${rowId(row)} → ${id}`)
  )

const sources = [
  ['SPEC.md', spec],
  ...walk(join(root, 'src')).map((path) => [relative(root, path), read(path)]),
]
const tagged = new Set(
  sources.filter(([path]) => path.endsWith('.test.js')).flatMap(([, text]) => testTags(text))
)
// A citation resolves to an ADR document only — not to a directory, a `.bak`
// or an editor swapfile that happens to start with the same number.
const adrFiles = readdirSync(join(root, 'docs', 'adr')).filter((name) => /^\d{4}-.+\.md$/.test(name))
const adrIsMissing = (number) => !adrFiles.some((file) => file.startsWith(`${number}-`))

const untested = (ids, tags) =>
  ids.filter((id) => !tags.has(id) && !UNTESTED_BY_DESIGN.includes(id))
const dangling = (ids, tags) => [...tags].filter((tag) => !ids.includes(tag))

describe('SPEC §V invariants are anchored to tests', () => {
  // Without this, renaming a heading or a table would empty every list below
  // and the whole gate would pass by having nothing left to check.
  it('found the tables it audits', () => {
    expect(invariants.length, 'no `| V<n> |` rows under `## §V`').toBeGreaterThan(0)
    expect(defects.length, 'no `| B<n> |` rows under `## §B`').toBeGreaterThan(0)
    expect(tasks.length, 'no `| T<n> |` rows under `## §T`').toBeGreaterThan(0)
    expect(tagged.size, 'no `V<n>:` test names anywhere under src/').toBeGreaterThan(0)
    expect(adrFiles.length, 'no `NNNN-*.md` files in docs/adr/').toBeGreaterThan(0)
  })

  it('a tag on a test that never runs is not coverage', () => {
    // Split so this fixture is not itself scanned as a tag above.
    const tag = "'V" + "6: x'"
    expect(testTags(`it.skip(${tag})`)).toEqual([])
    expect(testTags(`it.todo(${tag})\nit.fails(${tag})`)).toEqual([])
    expect(testTags(`it(${tag})`)).toEqual(['V6'])
  })

  it('every exemption still names an invariant, and stays just V9', () => {
    expect(
      dangling(invariants, UNTESTED_BY_DESIGN),
      'UNTESTED_BY_DESIGN ids with no SPEC §V row — the section was renumbered'
    ).toEqual([])
    expect(UNTESTED_BY_DESIGN, 'widening the exemption means editing this line too').toEqual(['V9'])
  })

  it('every invariant has at least one test named after it', () => {
    expect(
      untested(invariants, tagged),
      'SPEC §V ids with no `V<n>:` test — tag a test, or write one'
    ).toEqual([])
  })

  it('every `V<n>:` test tag names an invariant that still has a row', () => {
    expect(dangling(invariants, tagged), 'test tags with no SPEC §V row').toEqual([])
  })

  it('names the id of an invariant that gained a row but no test', () => {
    // V999 rather than the next real id, so a genuine new row cannot collide.
    expect(untested([...invariants, 'V999'], tagged)).toEqual(['V999'])
  })

  it('names the tag of an invariant whose row was deleted', () => {
    expect(dangling(['V1'], new Set(['V1', 'V99']))).toEqual(['V99'])
  })
})

describe('SPEC §B defects cite something that resolves', () => {
  it('every cited invariant has a §V row', () => {
    expect(
      unresolvedCitations(defects),
      'SPEC §B citations of a §V id that is not in the table'
    ).toEqual([])
  })

  it('every cited ADR names a file in docs/adr/', () => {
    const unresolved = defects.flatMap((row) =>
      adrNumbers(row)
        .filter(adrIsMissing)
        .map((number) => `${rowId(row)} → ADR-${number}`)
    )
    expect(unresolved, 'SPEC §B citations of an ADR with no file').toEqual([])
  })
})

describe('SPEC §T tasks cite something that resolves', () => {
  it('every cited invariant has a §V row', () => {
    expect(
      unresolvedCitations(tasks),
      'SPEC §T citations of a §V id that is not in the table'
    ).toEqual([])
  })

  it('names the row that cites an invariant with no row', () => {
    expect(unresolvedCitations(['| T99 | x | task | C1,V999 |'])).toEqual(['T99 → V999'])
  })
})

describe('ADR citations resolve to a file', () => {
  it('every ADR-000N in src/ or SPEC.md names a file in docs/adr/', () => {
    const unresolved = sources.flatMap(([path, text]) =>
      adrNumbers(text)
        .filter(adrIsMissing)
        .map((number) => `${path} → ADR-${number}`)
    )
    expect(unresolved, 'ADR citations with no file in docs/adr/').toEqual([])
  })

  it('names the id of an ADR with no file', () => {
    // Split so this fixture is not itself scanned as a citation above.
    expect(adrNumbers('see ADR-' + '0099').filter(adrIsMissing)).toEqual(['0099'])
  })
})

describe('the gates themselves are still on disk', () => {
  // A gate that is deleted takes its own assertions with it, so nothing inside
  // it can report its own absence. This list is the only check that outlives
  // one of them. It does not survive all three going at once, and it cannot
  // see a gate that is still on disk but no longer collected by the runner —
  // hence the explicit `test.include` in vite.config.js.
  it('src/meta/ holds all three gate files', () => {
    const present = readdirSync(join(root, 'src', 'meta'))
    const gates = ['bidi.test.js', 'locales.test.js', 'traceability.test.js']
    expect(
      gates.filter((name) => !present.includes(name)),
      'gate files missing from src/meta/ — restore them, or delete this list on purpose'
    ).toEqual([])
  })
})
