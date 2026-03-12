---
# llm-stream-parser-4bgn
title: Gemini normalizer
status: done
type: feature
priority: medium
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T01:23:32Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/gemini.ts`

- Function: `normalizeGeminiChunk(chunk: unknown): NormalizerResult`
- Map `candidates[0].content.parts[0].text` → `content`
- Map `candidates[0].content.parts` with `functionCall` type → `tool_calls`
- Map `usageMetadata` → `usage`
- Handle `finishReason` → `done`

Plan ref: Phase 1, Step 1.6
