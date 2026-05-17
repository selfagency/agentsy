# Stateful ops copilot backend (advanced)

This example shows a backend architecture for an operations copilot experience:

1. Ingest and process streamed model output.
2. Project stream events into a conversation state store.
3. Convert events to AG-UI-compatible stream events.
4. Recover from interrupted streams with continuation prompts.

## Packages used

```bash
npm install @agentsy/runtime @agentsy/core @agentsy/providers @agentsy/ui
```

## Illustrative implementation

```ts
import { toAgUiStream } from '@agentsy/runtime/ag-ui';
import { normalizeOpenAIResponseEvent } from '@agentsy/providers/normalizers';
import { createProcessorEventAdapter, LLMStreamProcessor } from '@agentsy/core/processor';
import { buildContinuationPrompt, captureStreamState } from '@agentsy/core/recovery';
import { parseSSEStream } from '@agentsy/core/sse';
import { createConversationStoreFromProcessor } from '@agentsy/ui';

async function* providerStream(messages: Array<{ role: string; content: string }>) {
  const response = await fetch('https://api.example.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4.1-mini', stream: true, messages })
  });

  const textStream = response.body?.pipeThrough(new TextDecoderStream());
  if (!textStream) {
    return;
  }

  for await (const event of parseSSEStream(textStream)) {
    if (event.data === '[DONE]') {
      return;
    }

    try {
      const parsed = JSON.parse(event.data) as unknown;
      const normalized = normalizeOpenAIResponseEvent(parsed);
      if (normalized === null) {
        continue;
      }
      yield normalized.chunk;
    } catch {
      // Ignore malformed SSE payloads in this showcase example.
    }
  }
}

export async function runStatefulOpsCopilot(conversationId: string): Promise<void> {
  const processor = new LLMStreamProcessor({ parseThinkTags: true });
  const bridge = createConversationStoreFromProcessor(processor, {
    conversationId
  });

  const eventAdapter = createProcessorEventAdapter(processor);
  const agUiStream = toAgUiStream(eventAdapter.stream);

  void (async () => {
    for await (const event of agUiStream) {
      broadcastToClients(conversationId, event);
    }
  })();

  const seedMessages = [
    {
      role: 'user',
      content: 'Review current incident telemetry and suggest next steps.'
    }
  ];

  try {
    for await (const chunk of providerStream(seedMessages)) {
      processor.process(chunk);
    }
    processor.flush();
  } catch {
    const snapshot = captureStreamState(processor);
    const continuationMessages = buildContinuationPrompt(snapshot, {
      provider: 'openai'
    });

    for await (const chunk of providerStream([...seedMessages, ...continuationMessages])) {
      processor.process(chunk);
    }
    processor.flush();
  }

  const state = bridge.store.getState();
  console.log('Final message count:', state.messages.length);
  bridge.dispose();
}
```

## Why this pattern is useful

- One stream-processing path can serve API clients and UI clients simultaneously.
- Conversation state is always derived from processor events, reducing drift.
- Continuation recovery improves resilience for long-running conversations.
