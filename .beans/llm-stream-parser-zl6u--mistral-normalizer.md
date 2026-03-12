---
# llm-stream-parser-zl6u
title: Mistral normalizer
status: done
type: feature
priority: medium
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T01:24:38Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/mistral.ts`
- Function: `normalizeMistralChunk(chunk: unknown): NormalizerResult`
- Map `choices[0].delta.content` → `content` (OpenAI-compatible format)
- Map `choices[0].delta.tool_calls` → `tool_calls`
- Map `usage` → `usage`
- Handle `finish_reason` → `done`

Plan ref: Phase 1, Step 1.7
