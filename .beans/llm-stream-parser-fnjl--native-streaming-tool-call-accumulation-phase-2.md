---
# llm-stream-parser-fnjl
title: Native Streaming Tool Call Accumulation (Phase 2)
status: completed
type: milestone
priority: high
created_at: 2026-03-12T00:14:27Z
updated_at: 2026-03-12T22:35:51Z
blocked_by:
    - llm-stream-parser-emui
---

Support native JSON tool calls from OpenAI/Claude that arrive as incremental argument deltas, complementing the existing XML-based extraction.

Includes ToolCallAccumulator class and LLMStreamProcessor integration.

See: docs/developers/gap-implementation-plan.md — Phase 2

## Todo

- [x] Create ToolCallAccumulator class (llm-stream-parser-t82p)
- [x] Integrate ToolCallAccumulator into LLMStreamProcessor (llm-stream-parser-do7d)
- [x] Write ToolCallAccumulator tests (llm-stream-parser-ct5m)

## Summary of Changes

- Added `ToolCallAccumulator` class with `addDelta`/`getCompletedCalls`/`flush`/`reset`
- Accumulates `NativeToolCallDelta` streams by index into complete `NativeToolCall` values
- Repairs incomplete JSON at flush time via existing `parseJson` with `repairIncomplete: true`
- Extended `XmlToolCall.format` union with `'native-json'`
- Integrated accumulator into `LLMStreamProcessor` behind `accumulateNativeToolCalls` option (default: true)
- Emits assembled calls as `tool_call` events with `format: 'native-json'` on done/flush
- 16 new tests; all 213 tests pass, type-check clean
- Merged via PR #28
