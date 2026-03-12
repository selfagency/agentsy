---
# llm-stream-parser-r7vt
title: Fix CRLF handling in appendToBlockquote
status: completed
type: bug
priority: high
created_at: 2026-03-11T22:44:27Z
updated_at: 2026-03-11T22:55:47Z
parent: llm-stream-parser-od93
---

appendToBlockquote only splits on `\n`, not `\r\n`. Windows CRLF produces orphaned `\r` characters. Fix by splitting on `/\r?\n/` or normalizing first. TDD: write failing tests for CRLF and mixed line endings.
