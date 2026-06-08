# `@agentsy/cli`

Command-line interface for local development and framework operator workflows.

## Purpose

`@agentsy/cli` is the canonical owner of framework-level **setup** and **doctor** UX. It also carries local development commands such as compression utilities and workspace diagnostics.

## Current command families

- `compress`
- `compress-memory`
- `memory-sync-dev`
- `setup`
- `doctor`
- `sandbox-diagnostics`
- `lb status`
- `chat`
- `tui`

## Boundary rule

Lower-level packages may expose reusable validation or setup helpers, but `@agentsy/cli` owns the end-user/operator command surface.
