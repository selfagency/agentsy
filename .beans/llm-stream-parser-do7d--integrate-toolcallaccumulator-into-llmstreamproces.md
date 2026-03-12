---
# llm-stream-parser-do7d
title: Integrate ToolCallAccumulator into LLMStreamProcessor
status: todo
type: feature
priority: high
created_at: 2026-03-12T00:16:06Z
updated_at: 2026-03-12T00:16:10Z
parent: llm-stream-parser-fnjl
id: llm-stream-parser-do7d
---

- Add optional `accumulateNativeToolCalls: boolean` option to `ProcessorOptions`
- When `StreamChunk` contains `nativeToolCallDeltas`, feed them to `ToolCallAccumulator`
- On `done`, emit completed calls as `tool_call` events
- Map completed `NativeToolCall` to existing `XmlToolCall` interface (with `format: 'native-json'` added)
- Extend `XmlToolCall` type: `format: 'bare-xml' | 'json-wrapped' | 'native-json'`

Plan ref: Phase 2, Step 2.2
