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

## Notes

This package is currently in active development. API surface is subject to change.
