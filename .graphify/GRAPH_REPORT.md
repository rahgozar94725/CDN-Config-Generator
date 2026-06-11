# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~3,998 words - fits in a single context window. You may not need a graph.

## Summary
- 58 nodes · 64 edges · 5 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 44 · calls: 13 · imports: 6 · imports_from: 1


## Input Scope
- Requested: auto
- Resolved: all (source: default-auto)
- Included files: 17 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed
## God Nodes (most connected - your core abstractions)
1. `buildLink()` - 6 edges
2. `parseConfig()` - 6 edges
3. `parseVmess()` - 5 edges
4. `setLocale()` - 3 edges
5. `generateConfigs()` - 3 edges
6. `genRandomSni()` - 3 edges
7. `parseVless()` - 3 edges
8. `parseTrojan()` - 3 edges
9. `saveLocale()` - 2 edges
10. `applyDirection()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.33
Nodes (9): decodeBase64(), normalizeVmessSecurity(), parseConfig(), parseTrojan(), parseVless(), parseVmess(), b64, obj (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.20
Nodes (8): cdnList, configs, opts, optsTlsNoAlpn, optsTlsNoFp, out, outNoAlpn, outNoFp

### Community 2 - "Community 2"
Cohesion: 0.39
Nodes (8): ALLOWED_TRANSPORTS, buildLink(), buildTrojan(), buildVless(), buildVmess(), extractRootDomain(), generateConfigs(), genRandomSni()

### Community 4 - "Community 4"
Cohesion: 0.38
Nodes (5): applyDirection(), i18n, rtlLocales, saveLocale(), setLocale()

### Community 5 - "Community 5"
Cohesion: 0.40
Nodes (1): app

## Knowledge Gaps
- **15 isolated node(s):** `rtlLocales`, `i18n`, `app`, `ALLOWED_TRANSPORTS`, `configs` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 5`** (1 nodes): `app`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `parseConfig()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `generateConfigs()` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `rtlLocales`, `i18n`, `app` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._