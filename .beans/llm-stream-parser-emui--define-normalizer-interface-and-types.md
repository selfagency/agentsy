---
# llm-stream-parser-emui
title: Define normalizer interface and types
status: done
type: feature
priority: high
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T01:13:39Z
parent: llm-stream-parser-nl5r
---

Create `src/normalizers/types.ts` with:
- `NormalizerResult` type: `{ chunk: StreamChunk; usage?: UsageInfo; rawEvent?: unknown }`
- `UsageInfo` type: `{ inputTokens?: number; outputTokens?: number; totalTokens?: number }`
- `NativeToolCallDelta` type: `{ index: number; id?: string; name?: string; argumentsDelta?: string }`
- Extend `StreamChunk` to include optional `usage` and `nativeToolCallDeltas` fields

Plan ref: Phase 1, Step 1.1
