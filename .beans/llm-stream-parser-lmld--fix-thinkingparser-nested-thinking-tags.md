---
# llm-stream-parser-lmld
title: Fix ThinkingParser nested thinking tags
status: todo
type: bug
priority: critical
created_at: 2026-03-11T22:44:23Z
updated_at: 2026-03-11T22:44:23Z
---

`<think>outer<think>inner</think></think>` matches the innermost `</think>` first via `.indexOf()`, producing malformed output. Fix by tracking nesting depth. TDD: write failing tests for nested tag patterns.
