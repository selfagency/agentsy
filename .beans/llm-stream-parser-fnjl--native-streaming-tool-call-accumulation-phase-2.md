---
# llm-stream-parser-fnjl
title: Native Streaming Tool Call Accumulation (Phase 2)
status: in-progress
type: milestone
priority: high
created_at: 2026-03-12T00:14:27Z
updated_at: 2026-03-12T12:39:31Z
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
