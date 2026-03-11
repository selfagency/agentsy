---
# llm-stream-parser-qif0
title: Fix ThinkingParser multiple thinking blocks
status: todo
type: bug
priority: critical
created_at: 2026-03-11T22:44:19Z
updated_at: 2026-03-11T22:44:19Z
---

ThinkingParser state machine enters `thinkingDone` after first block and never re-enters `lookingForOpening`. Fix to support multiple think blocks (concatenate thinking, pass through content between blocks). TDD: write failing tests first for `<think>a</think>text<think>b</think>` pattern.
