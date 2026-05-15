# @agentsy/cli

CLI utilities for the Agentsy monorepo.

## Status

Internal package; APIs and scripts may evolve.

## Phase 0 commands

- `compress --level <lite|full|ultra> --text <content>`
- `compress --level <lite|full|ultra> --file <path>`
- `compress-memory --file <path>` (writes backup to `<path>.original.md`)
- `memory-sync-dev [--json] [--server-db <path>] [--replica-db <path>] [--bind <host:port>] [--server-url <url>] [--sync-interval-ms <ms>]`

## Local Turso sync server wiring

Use the `memory-sync-dev` command to print a local development wiring example for the Turso sync server flow used by `@agentsy/memory`.

- default server command: `tursodb ./.agentsy/local-sync-server.db --sync-server 0.0.0.0:8080`
- default client URL: `http://localhost:8080`
- auth token: omitted for local sync server development

Example:

- `memory-sync-dev`
- `memory-sync-dev --json`
