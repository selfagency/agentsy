---
# llm-stream-parser-nfcw
title: Add timeout for external validator adapters
status: todo
type: task
priority: high
created_at: 2026-03-11T22:44:36Z
updated_at: 2026-03-11T22:48:51Z
parent: llm-stream-parser-17er
---

validateJsonSchema accepts an external `validator` function that could hang indefinitely. Wrap validator call with a configurable `validatorTimeoutMs` option.
