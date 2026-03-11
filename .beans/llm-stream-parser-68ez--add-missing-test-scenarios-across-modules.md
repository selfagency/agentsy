---
# llm-stream-parser-68ez
title: Add missing test scenarios across modules
status: todo
type: task
priority: normal
created_at: 2026-03-11T22:45:26Z
updated_at: 2026-03-11T22:45:26Z
---

Add missing test scenarios: ThinkingParser (multiple/nested/unclosed), appendToBlockquote (CRLF/mixed/empty), LLMStreamProcessor (flush→reset→process, multiple flush, concurrent events), XmlStreamFilter (large docs, pathological nesting, CDATA/comments), Adapters (errors, backpressure).
