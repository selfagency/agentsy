# Roadmap (planned)

This roadmap summarizes future implementation plans from `plan/*.md`.

## Important

Everything on this page is **planned**, not guaranteed until implemented in `packages/`.

## Current implementation baseline

- Monorepo package split is in place for stream parsing/orchestration layers.
- Published package today: `@agentsy/vscode`.

## Planned platform tracks

From `plan/agentsy-platform-v2.md`:

- Additional runtime-oriented packages (`runtime`, `session`, `memory`, `retrieval`, `providers`, `mcp`, etc.).
- Compatibility and migration layers around historical `@agentsy/core` usage.
- Expanded extensibility hooks and agent lifecycle capabilities.

From `plan/agentsy-features-v1.md`:

- Slash command registry and skill management packages.
- Caveman/superpowers feature families.
- Connector gateway and first-party chat adapters.

## Source plan docs

- `plan/agentsy-platform-v2.md`
- `plan/agentsy-prd.md`
- `plan/agentsy-features-v1.md`
- `plan/agentsy-tech.md`
- `plan/agentsy-agents-v1.md`
- `plan/agentsy-connectors-v1.md`
- `plan/agentsy-standalone-v1.md`

## How to interpret roadmap status

- **Implemented**: functionality exists in package source under `packages/`.
- **Planned**: specified in `plan/` but not yet implemented.
- **In progress**: actively being delivered on the current working branch/PR.
