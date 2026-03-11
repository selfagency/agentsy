---
# llm-stream-parser-zmdr
title: Fix processor reuse semantics after flush
status: todo
type: bug
priority: high
created_at: 2026-03-11T22:44:41Z
updated_at: 2026-03-11T22:48:51Z
parent: llm-stream-parser-17er
---

LLMStreamProcessor.flush() sets `doneEmitted` flag that may not be cleared by reset(). Audit reset() to ensure all state including doneEmitted is cleared. Add JSDoc and test for flush()→reset()→process() sequence.
