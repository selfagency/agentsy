---
# llm-stream-parser-tszm
title: OpenAI Responses API normalizer
status: todo
type: feature
priority: high
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T00:15:21Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/openaiResponses.ts`
- Function: `normalizeOpenAIResponseEvent(event: unknown): NormalizerResult`
- Map `response.output_text.delta` → `content`
- Map `response.function_call_arguments.delta` → `nativeToolCallDeltas`
- Map `response.completed` → `done: true`
- Handle `response.refusal.delta` as warning

Plan ref: Phase 1, Step 1.3
