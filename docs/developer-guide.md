# Developer Guide

This document covers local development, testing, and release operations for `llm-stream-parser`.

## Prerequisites

- Node.js 20+
- pnpm (version pinned in `package.json`)
- `task` CLI (optional, recommended)

## Install

```bash
pnpm install
```

`pnpm install` is the only required direct package-manager command for normal development.

## Build and verify

```bash
task compile
task check-types
task unit-tests
task lint
task check-formatting
task formatting
```

## Taskfile workflow

Run tasks via:

```bash
task <task-name>
```

Primary tasks:

- `check-types`
- `lint`
- `check-formatting`
- `formatting`
- `compile`
- `unit-tests`
- `unit-test-coverage`
- `release`
- `test-build-release`
- `watch`

## Testing strategy

- Keep parser behavior deterministic across chunk boundaries.
- Assert safety rails explicitly:
  - privacy scrub defaults
  - tool-call count/size limits
  - JSON depth/key limits
- Add targeted unit tests beside source modules in `src/**`.

## Release flow

The package uses scripted release automation:

1. Build with `pnpm run build` (runs `postbuild` to prepare `dist/package.json`).
2. Trigger release with `task release -- <version>`.
3. CI workflows:
   - `Test & Build`
   - `Release`

When possible, prefer `task` commands over direct `pnpm run ...` scripts for consistency.

The release script publishes `./dist` to npm:

- stable versions → `latest`
- prerelease versions → `next`
