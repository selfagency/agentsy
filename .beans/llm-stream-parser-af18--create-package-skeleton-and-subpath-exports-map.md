---
# llm-stream-parser-af18
title: Create package skeleton and subpath exports map
status: completed
type: task
priority: high
created_at: 2026-03-11T17:09:45Z
updated_at: 2026-03-11T17:30:48Z
parent: llm-stream-parser-nhot
---

Implement package scaffolding, build config, barrel exports, and documented subpath export map for `llm-stream-parser`.

## Summary of Changes

- Added package build/test scripts and subpath exports in `package.json`.
- Added project build/test configs (`tsup.config.ts`, `vitest.config.ts`, refined `tsconfig.json`).
- Scaffolded `src/` module layout with initial placeholders for `thinking`, `xml-filter`, `tool-calls`, and `context` modules plus root exports.
- Added baseline smoke test (`src/index.test.ts`) and validated scaffold with type-check and unit tests.
