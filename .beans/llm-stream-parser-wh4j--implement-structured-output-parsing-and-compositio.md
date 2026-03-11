---
# llm-stream-parser-wh4j
title: Implement structured output parsing and composition helpers
status: completed
type: task
priority: high
branch: feat/wh4j-structured-output-helpers
pr: 14
created_at: 2026-03-11T17:09:45Z
updated_at: 2026-03-11T17:09:53Z
parent: llm-stream-parser-7hpp
blocked_by:
    - llm-stream-parser-af18
---

Implement JSON extraction/validation, format instruction generation, repair prompt construction, and parser `pipe()` composition.

## Todo

- [x] Add structured parsing module (`parseJson`) with fence/prose extraction and optional incomplete repair.
- [x] Add schema validation helper (`validateJsonSchema`) with deterministic error messages.
- [x] Add prompt helpers (`buildFormatInstructions`, `buildRepairPrompt`).
- [x] Add functional composition utility (`Parser` + `pipe`) and export from package root/subpath.
- [x] Add/expand tests for structured parsing and composition behavior.
- [x] Run `pnpm run check-types` and `pnpm run test`.

## Summary of Changes

- Added new `src/structured` module with `parseJson`, `validateJsonSchema`, `buildFormatInstructions`, `buildRepairPrompt`, and `pipe` utilities.
- Implemented markdown-fence/prose JSON extraction, multi-candidate selection, and best-effort incomplete JSON repair.
- Implemented deterministic JSON Schema subset validation errors for object/array/string/number/integer/boolean flows.
- Added package/build exports for `./structured` and root-level re-exports.
- Added comprehensive structured parsing/composition tests in `src/structured/structured.test.ts`.
- Verified end-to-end with `pnpm run check-types` and `pnpm run test` (all passing).
