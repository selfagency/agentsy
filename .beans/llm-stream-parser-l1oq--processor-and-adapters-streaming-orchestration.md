---
# llm-stream-parser-l1oq
title: processor and adapters streaming orchestration
status: todo
type: epic
priority: high
created_at: 2026-03-11T17:08:25Z
updated_at: 2026-03-11T17:09:15Z
parent: llm-stream-parser-q8qn
---

Implement `LLMStreamProcessor`, accumulation/events/parts ergonomics, and generic + VS Code adapters (plan sections 5b, 5e, 5f, 5g, 5i).

## Todo
- [ ] Implement processor chunk/complete/flush flow.
- [ ] Add events, accumulated message, and discriminated parts.
- [ ] Provide generic async iterable and VS Code adapters.
