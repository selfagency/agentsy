# `@agentsy/core/processor`

- **Status:** Published subpath export from `@agentsy/core`
- **Role:** Core stream processing primitives and provider-agnostic transforms

## Where it fits

`@agentsy/core/processor` is the center of the current streaming stack. It consumes normalized events and produces a stable flow that downstream renderers, stores, and agent loops can use.

## Key exports

- `LLMStreamProcessor`
- `createProcessorEventAdapter`
- `ToolCallParser`
- `ZAiInlineToolCallParser`
- `createSmoothStream`
- `createThinkingFilter`
- `createToolCallFilter`

## Available APIs

- Processor runtime: `LLMStreamProcessor`, `createProcessorEventAdapter`
- Tool-call parsing helpers: `ToolCallParser`, `ZAiInlineToolCallParser`
- Processor transforms: `createSmoothStream`, `createThinkingFilter`, `createToolCallFilter`
- SSE helpers re-exported from the processor package surface

## Use it when

- you already have provider chunks normalized and need an incremental processor
- you want reusable stream transforms instead of bespoke event glue
- you need the main orchestration layer beneath UI or agent code

## Common neighbors

- Upstream: `@agentsy/providers/normalizers`, `@agentsy/providers/pipeline`
- Side utilities: `@agentsy/core/thinking`, `@agentsy/core/tool-calls`, `@agentsy/core/structured`
- Downstream: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/orchestrator/agent`, `@agentsy/vscode`

## Example

```ts
import { LLMStreamProcessor } from '@agentsy/core/processor';
import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
import { createPipeline } from '@agentsy/providers/pipeline';

const processor = new LLMStreamProcessor();
for await (const event of createPipeline(openAiSseStream, { provider: 'openai' })) {
  console.log(event);
}
```

## Implementation example with neighbors

```ts
import { normalizeAnthropicEvent } from '@agentsy/providers/normalizers';
import { LLMStreamProcessor } from '@agentsy/core/processor';
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

Use `@agentsy/core/processor` for the processor itself, and pair it with `@agentsy/providers/*` when you need provider-specific normalizers, adapters, or SSE pipelines.
