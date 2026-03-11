---
# llm-stream-parser-tqpf
title: Harden privacy defaults and limit enforcement
status: completed
type: feature
priority: high
created_at: 2026-03-11T17:09:32Z
updated_at: 2026-03-11T20:51:52Z
parent: llm-stream-parser-kfsw
branch: feat/tqpf-harden-privacy-defaults-limit-enforcement
pr: 18
---

Enforce default privacy scrub tags, override safeguards, hard limits, and warning telemetry for adversarial or oversized outputs.

## Todo

- [x] Add parser limits for JSON depth/key count and XML nesting depth.
- [x] Add deterministic warnings/failures for limit breaches.
- [x] Add/expand tests for new limit enforcement paths.
- [x] Run `pnpm run check-types` and `pnpm run test`.

## Summary of Changes

- Added JSON hard limits to structured parsing options: `maxJsonDepth` and `maxJsonKeys`.
- Enforced JSON limits in `parseJson()` (returns `null` when limits are exceeded).
- Added deterministic JSON limit errors in `validateJsonSchema()` for depth/key overflow.
- Added XML hard limit to stream filtering: `maxXmlNestingDepth` with warning telemetry.
- Threaded `maxXmlNestingDepth` through `LLMStreamProcessor` options into `createXmlStreamFilter()`.
- Added regression tests for XML nesting-limit suppression/warnings and JSON depth/key limit behavior.
- Re-validated with green `pnpm run check-types` and `pnpm run test`.
