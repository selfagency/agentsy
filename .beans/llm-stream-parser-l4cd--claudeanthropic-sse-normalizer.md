---
# llm-stream-parser-l4cd
title: Claude/Anthropic SSE normalizer
status: done
type: feature
priority: high
created_at: 2026-03-12T00:15:12Z
updated_at: 2026-03-12T01:20:39Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/anthropic.ts`

- Function: `normalizeAnthropicEvent(event: unknown): NormalizerResult`
- Map `content_block_delta` with `text_delta` → `content`
- Map `content_block_delta` with `thinking_delta` → `thinking`
- Map `content_block_delta` with `input_json_delta` → `nativeToolCallDeltas`
- Map `content_block_start` with `tool_use` type → capture tool name+id
- Map `message_delta` with `usage` → `usage`
- Map `message_stop` → `done: true`

Plan ref: Phase 1, Step 1.4
