---
# llm-stream-parser-5fce
title: field by field partial json streaming
status: todo
type: task
priority: medium
created_at: 2026-03-12T00:16:33Z
updated_at: 2026-03-12T00:16:38Z
parent: llm-stream-parser-rfc0
---

Enhance `src/structured/streamJson.ts`:
- Add `StreamJsonField` type: `{ path: string; value: unknown; isComplete: boolean }`
- Add optional `emitFields: boolean` option to `StreamJsonOptions`
- When enabled, diff successive partial parses to detect newly populated fields
- Yield `StreamJsonResult<T>` extended with `newFields: StreamJsonField[]`
- Support array item emission: when an array grows, emit each new complete item
- Add `status: 'partial' | 'completed'` to `StreamJsonResult` (keep `isPartial` for backward compat)

Plan ref: Phase 3, Step 3.1
