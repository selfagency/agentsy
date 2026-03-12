---
# llm-stream-parser-y1o3
title: OpenAI Chat Completions normalizer
status: done
type: feature
priority: high
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T01:16:39Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/openai.ts`
- Function: `normalizeOpenAIChatChunk(chunk: unknown): NormalizerResult`
- Map `choices[0].delta.content` → `content`
- Map `choices[0].delta.tool_calls` → `nativeToolCallDeltas`
- Extract `usage` from final chunk
- Handle `finish_reason` → `done`

Plan ref: Phase 1, Step 1.2
