---
# llm-stream-parser-rfc0
title: Enhanced Streaming & Recovery (Phase 3)
status: completed
type: milestone
priority: normal
created_at: 2026-03-12T12:27:55Z
updated_at: 2026-03-13T00:18:34Z
---

Enhanced partial JSON field-by-field streaming, stream error recovery utilities, and usage/token tracking.

See: docs/developers/gap-implementation-plan.md — Phase 3

## Todo

- [x] Step 3.3: Usage/token tracking (ProcessedOutput, AccumulatedMessage, StreamEventMap)
- [x] Step 3.1: Field-by-field partial JSON streaming (streamJson.ts)
- [x] Step 3.2: Stream error recovery utilities (src/recovery/index.ts)
- [x] Step 3.4: Tests for all Phase 3 features
- [x] Update barrel exports (src/index.ts)

## Summary of Changes

- `src/structured/streamJson.ts`: Added `StreamJsonField`, `emitFields` option, `status: 'partial'|'completed'`, `newFields` field diffing via dot/index path notation
- `src/recovery/index.ts`: New module with `captureStreamState`, `buildContinuationPrompt` (openai/anthropic/ollama), `StreamSnapshot`, `ContinuationMessage` types
- `src/processor/LLMStreamProcessor.ts`: Usage tracking — `_accumulatedUsage`, `usage` event, merged across chunks
- `src/processor/AccumulatedMessage.ts`: Added `usage?: UsageInfo`
- `src/structured/streamJson.ts`: `ProcessedOutput` and `AccumulatedMessage` include `usage?`
- 32 new tests; 245 total passing. Merged as PR #30.
