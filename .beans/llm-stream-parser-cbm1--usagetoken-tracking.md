---
# llm-stream-parser-cbm1
title: usagetoken tracking
status: todo
type: task
priority: medium
created_at: 2026-03-12T00:16:33Z
updated_at: 2026-03-12T00:16:38Z
parent: llm-stream-parser-rfc0
---

- Add `usage?: UsageInfo` to `ProcessedOutput` and `AccumulatedMessage`
- In `LLMStreamProcessor.process()`, if `StreamChunk` contains `usage`, merge into accumulated usage
- Add `usage` event to `StreamEventMap`: `usage: (usage: UsageInfo) => void`
- Emit `usage` event when usage data is received

Plan ref: Phase 3, Step 3.3
