---
# llm-stream-parser-t82p
title: Create ToolCallAccumulator
status: todo
type: feature
priority: high
created_at: 2026-03-12T00:16:06Z
updated_at: 2026-03-12T00:16:10Z
parent: llm-stream-parser-fnjl
id: llm-stream-parser-t82p
---

Create `src/tool-calls/ToolCallAccumulator.ts`

- Class: `ToolCallAccumulator`
  - `addDelta(delta: NativeToolCallDelta): void` — accumulate partial JSON arguments by index
  - `getCompletedCalls(): NativeToolCall[]` — return tool calls whose arguments form valid JSON
  - `flush(): NativeToolCall[]` — force-complete any pending calls (attempt JSON parse/repair)
  - `reset(): void`
- Internal state: `Map<number, { id?: string; name: string; argumentsBuffer: string }>`
- `NativeToolCall` type: `{ id?: string; name: string; arguments: Record<string, unknown> }`
- Edge cases: name arrives separately, multiple parallel calls by index, malformed JSON at flush

Plan ref: Phase 2, Step 2.1
