# `@agentsy/cli`

Command-line interface for local development and agent execution.

## Purpose

`@agentsy/cli` provides a terminal interface for running Agentsy agents, inspecting streams, and interacting with local provider configurations during development.

## Status

- Internal/pre-release workspace package.
- See the [roadmap](../roadmap.md) for planned capabilities.

Current implementation includes Phase 0 compression commands:

- `compress --level <lite|full|ultra> --text <content>`
- `compress --level <lite|full|ultra> --file <path>`
- `compress-memory --file <path>`
- `memory-sync-dev [--json] [--server-db <path>] [--replica-db <path>] [--bind <host:port>] [--server-url <url>] [--sync-interval-ms <ms>]`

The package now also exposes a local Turso sync server development helper command that prints:

- the `tursodb ... --sync-server ...` command to start a local sync server
- matching environment variable wiring for `@agentsy/memory`
- an example `createTursoManager(...)` snippet for a local replica setup

## Testing

### Unit tests (Vitest)

Colocated `.test.ts` files alongside source code cover function-level behavior (compress, compress-memory, memory-sync-dev, chat). Run with `pnpm test`.

### E2E tests (tui-test)

[`@microsoft/tui-test`](https://github.com/microsoft/tui-test) provides real-PTY terminal testing for all CLI commands. Specs live in `src/e2e/*.spec.ts` and are configured via `tui-test.config.ts`.

```bash
pnpm test:e2e     # Build + run E2E
pnpm test:e2e:dev # Run E2E only (assumes dist/ built)
```

E2E specs are required for each CLI command and are enforced in CI.

## Notes

This package is currently in active development. API surface is subject to change.
