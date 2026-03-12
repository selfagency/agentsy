---
# llm-stream-parser-5bmr
title: Close extraction plan gaps before Opilot integration
status: completed
type: task
priority: high
created_at: 2026-03-11T21:15:47Z
updated_at: 2026-03-11T21:21:38Z
parent: llm-stream-parser-q8qn
branch: feat/5bmr-close-extraction-plan-gaps-main
pr: 17
---

Implement remaining plan gaps in llm-stream-parser before final Opilot rollout task:

- Add ThinkingParser.forModel() convenience factory.
- Add processor thinkingTagMap support for model-specific tag pairs.
- Add buildXmlToolSystemPrompt utility export.
- Add sanitizeNonStreamingModelOutput + formatXmlLikeResponseForDisplay utilities export.
- Add validator adapter support to validateJsonSchema.
- Add tests and update exports.

## Todo

- [x] Add thinking tag map + `ThinkingParser.forModel()`.
- [x] Add prompt/formatting utility modules and exports.
- [x] Add validation adapter support to `validateJsonSchema`.
- [x] Add/expand tests for new APIs.
- [x] Run `pnpm run check-types` and `pnpm run test`.

## Summary of Changes

- Added `ThinkingParser.forModel()` with built-in and caller-extended model→tag selection.
- Added `modelId` + `thinkingTagMap` support in `LLMStreamProcessor`.
- Added `buildXmlToolSystemPrompt` to `tool-calls` exports with dedicated tests.
- Added new `formatting` module with `formatXmlLikeResponseForDisplay` and `sanitizeNonStreamingModelOutput`.
- Added optional external validator adapter support to `validateJsonSchema`.
- Updated root/subpath exports and build entries; all tests and type-check pass.
