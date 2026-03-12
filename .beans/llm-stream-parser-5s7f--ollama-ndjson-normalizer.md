---
# llm-stream-parser-5s7f
title: Ollama NDJSON normalizer
status: done
type: feature
priority: high
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T01:22:10Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/ollama.ts`

- Function: `normalizeOllamaChatChunk(chunk: unknown): NormalizerResult`
  - Map `message.content` → `content`, `message.tool_calls` → `tool_calls`
  - Handle inline `<think>` tags, `done: true`, duration/eval metrics
- Function: `normalizeOllamaGenerateChunk(chunk: unknown): NormalizerResult`
  - Map `response` → `content`, `done` → `done`

Plan ref: Phase 1, Step 1.5
