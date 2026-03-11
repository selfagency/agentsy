---
# llm-stream-parser-srwl
title: structured output utilities and parser composition
status: completed
type: epic
priority: high
created_at: 2026-03-11T17:08:24Z
updated_at: 2026-03-11T20:55:15Z
parent: llm-stream-parser-q8qn
---

Implement structured JSON extraction and validation utilities, format instructions, repair prompt builder, and parser composition utilities (plan sections 5d and 5h).

## Todo
- [x] Add JSON parsing and incomplete-repair options.
- [x] Add JSON Schema validation contract and adapters.
- [x] Add format/repair prompt generation and `pipe()` composition.

## Summary of Changes
- Completed through `llm-stream-parser-7hpp` + task `llm-stream-parser-wh4j`.
- Implemented structured parsing/validation, prompt helpers, and parser composition APIs.
- Added tests for structured parsing behavior and composition.
