# `@agentsy/processor`

- **Status:** Published
- **Role:** Event-driven stream orchestration and transform pipeline

## Where it fits

`@agentsy/processor` is the center of the current streaming stack. It consumes normalized events and produces a stable flow that downstream renderers, stores, and agent loops can use.

## Key exports

- `LLMStreamProcessor`
- `createProcessorEventAdapter`
- `ToolCallParser`
- `ZAiInlineToolCallParser`
- `createPipeline`
- `createSmoothStream`
- `createThinkingFilter`
- `createToolCallFilter`

## Available APIs

- Processor runtime: `LLMStreamProcessor`, `createProcessorEventAdapter`
- Tool-call parsing helpers: `ToolCallParser`, `ZAiInlineToolCallParser`
- Pipeline helpers: `createPipeline`, `createSmoothStream`, `createThinkingFilter`, `createToolCallFilter`
- SSE helpers re-exported from the processor package surface

## Use it when

- you already have provider chunks normalized and need an incremental processor
- you want reusable stream transforms instead of bespoke event glue
- you need the main orchestration layer beneath UI or agent code

## Common neighbors

- Upstream: `@agentsy/normalizers`
- Side utilities: `@agentsy/thinking`, `@agentsy/tool-calls`, `@agentsy/structured`
- Downstream: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/agent`, `@agentsy/vscode`

## Example

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
import { createPipeline, LLMStreamProcessor } from '@agentsy/processor';

const processor = new LLMStreamProcessor();
const pipeline = createPipeline();

pipeline.use(processor);

for await (const rawChunk of openAiStream) {
  pipeline.write(normalizeOpenAIChatChunk(rawChunk));
}
```

## Implementation example with neighbors

```ts
import { normalizeAnthropicEvent } from '@agentsy/normalizers';
import { LLMStreamProcessor } from '@agentsy/processor';
import { createConversationStoreFromProcessor } from '@agentsy/ui';

const processor = new LLMStreamProcessor({ parseThinkTags: true });
const bridge = createConversationStoreFromProcessor(processor, { conversationId: 'demo-conversation' });

for await (const event of anthropicEventStream) {
  processor.process(normalizeAnthropicEvent(event));
}

console.log(bridge.store.getState().messages.length);
bridge.dispose();
```

## Notes

This package is the best starting point when you are building on top of the current low-level ecosystem rather than the published VS Code integration.
