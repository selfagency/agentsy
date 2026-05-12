# `@agentsy/ui`

- **Status:** Published
- **Role:** Conversation-state store and processor binding helpers

## Key exports

- `createConversationStore`
- `createConversationStoreFromProcessor`
- `bindProcessorToConversationStore`
- `applyConversationEvent`

## Available APIs

- Conversation store creation
- Reducer-style event application
- Processor-to-store bridge helpers
- UI conversation and message-part types

## Where it fits

This package projects processed events into application state. Use it when you need a store-shaped model rather than direct renderer output.

## Common neighbors

- `@agentsy/core/processor`
- `@agentsy/renderers`
- `@agentsy/vscode`

## Implementation example with neighbors

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
import { LLMStreamProcessor } from '@agentsy/core/processor';
import { createConversationStoreFromProcessor } from '@agentsy/ui';

const processor = new LLMStreamProcessor({ parseThinkTags: true });
const bridge = createConversationStoreFromProcessor(processor, { conversationId: 'conversation-1' });

for await (const rawChunk of stream) {
  processor.process(normalizeOpenAIChatChunk(rawChunk));
}

console.log(bridge.store.getState().messages);
bridge.dispose();
```
