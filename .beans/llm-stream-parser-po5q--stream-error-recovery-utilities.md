---
# llm-stream-parser-po5q
title: stream error recovery utilities
status: todo
type: task
priority: medium
created_at: 2026-03-12T00:16:33Z
updated_at: 2026-03-12T00:16:38Z
parent: llm-stream-parser-rfc0
---

Create `src/recovery/index.ts` with:

- `captureStreamState(processor: LLMStreamProcessor): StreamSnapshot` — capture accumulated content, thinking, tool calls, and processor options for resumption
- `buildContinuationPrompt(snapshot: StreamSnapshot, options?)` — generate provider-appropriate continuation prompt
  - Claude ≤4.5: prepend partial assistant message
  - Claude 4.6+: add user message with "continue from where you left off"
  - OpenAI: append partial assistant message
- `StreamSnapshot` type: `{ content, thinking, toolCalls, options, timestamp }`

Plan ref: Phase 3, Step 3.2
