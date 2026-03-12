---
# llm-stream-parser-7hpp
title: Add structured output and parser composition APIs
status: completed
type: feature
priority: high
created_at: 2026-03-11T17:09:32Z
updated_at: 2026-03-11T20:55:15Z
parent: llm-stream-parser-srwl
---

Implement `parseJson`, schema validation, format instruction generation, repair prompt builder, and parser composition utilities.

## Todo

- [x] Implement `parseJson` with prose/markdown extraction and optional incomplete repair.
- [x] Implement schema validation and deterministic error handling.
- [x] Implement prompt helpers and parser composition utility.

## Summary of Changes

- Delivered via completed task `llm-stream-parser-wh4j`.
- Added `src/structured/*` modules, exports wiring, and comprehensive tests.
- Verified with green type-check and unit tests.
