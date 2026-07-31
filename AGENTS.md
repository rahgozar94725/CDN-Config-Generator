# CDN-Config-Generator

## graphify

This project uses a graphify knowledge graph at `.graphify/`.

Rules:
- For codebase or architecture questions, first run `graphify query "<question>"` (or `graphify path` / `graphify explain`) — returns a scoped subgraph, much smaller than `GRAPH_REPORT.md` or raw grep
- Navigate `.graphify/wiki/index.md` if it exists
- Run the `graphify` skill with `--update` when `.graphify/needs_update` exists or `.graphify/branch.json` has stale=true
- Use `graphify review-delta --graph .graphify/graph.json` for review impact on changed files
- After modifying code files, run `npx graphify hook-rebuild` to keep the graph current
