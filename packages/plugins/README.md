# @agentsy/plugins

Plugin registration and plugin-facing extension points.

This package also carries the current scaffold for agent-to-agent coordination that was consolidated from the previously planned `@agentsy/agents` package.

## Status

Pre-release package; plugin contracts may evolve.

## Current entrypoints

- `@agentsy/plugins` — root plugin package surface
- `@agentsy/plugins/agents` — A2A coordination scaffold

## Ownership boundary

`@agentsy/plugins` owns manifest metadata, capability discovery, and extensibility contracts. Framework-level `setup` and `doctor` UX belongs to `@agentsy/cli`, while helper-role semantics belong to `@agentsy/orchestrator`.
