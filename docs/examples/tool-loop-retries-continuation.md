# Agent tool loop with retries and continuation (showcase)

This example shows a workflow you could build when you need more than one-shot generation:

1. Run a multi-step tool loop.
2. Retry provider calls on transient failures.
3. Capture stream state when interrupted.
4. Build continuation messages and resume without losing context.

## Packages used

```bash
npm install @agentsy/orchestrator/agent @agentsy/core @agentsy/providers
```

## Illustrative implementation

```ts
import { createAgentLoop, isStepCount } from '@agentsy/orchestrator/agent';
import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
import { LLMStreamProcessor } from '@agentsy/core/processor';
import { buildContinuationPrompt, captureStreamState } from '@agentsy/core/recovery';
import { buildToolResultMessage } from '@agentsy/core/tool-calls';

const MAX_STREAM_RETRIES = 2;

async function* executeWithRetries(messages: Array<{ role: string; content: string }>) {
  const processor = new LLMStreamProcessor({ parseThinkTags: true });

  let workingMessages = messages;
  for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.example.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          stream: true,
          messages: workingMessages
        })
      });

      for await (const rawChunk of response.body as AsyncIterable<unknown>) {
        const normalized = normalizeOpenAIChatChunk(rawChunk);
        if (!normalized) {
          continue;
        }

        const output = processor.process(normalized.chunk);
        if (output.content) {
          yield { type: 'text' as const, text: output.content };
        }
        for (const toolCall of output.toolCalls) {
          yield { type: 'tool_call' as const, call: toolCall };
        }
      }

      processor.flush();
      return;
    } catch (error) {
      if (attempt === MAX_STREAM_RETRIES) {
        throw error;
      }

      // Recover context from partial stream and ask the model to continue.
      const snapshot = captureStreamState(processor);
      const continuation = buildContinuationPrompt(snapshot, { provider: 'openai' });
      workingMessages = [...workingMessages, ...continuation];
    }
  }
}

const loop = createAgentLoop({
  execute: executeWithRetries,
  stopWhen: [isStepCount(8)],
  buildToolResultMessages: async toolCalls => {
    const results = [];
    for (const call of toolCalls) {
      const toolResult = await runTool(call.name, call.parameters);
      results.push(buildToolResultMessage(call, toolResult));
    }
    return results;
  }
});

for await (const part of loop.run([{ role: 'user', content: 'Investigate elevated 5xx rates and propose fixes.' }])) {
  if (part.type === 'text') {
    process.stdout.write(part.text);
  }
}
```

## Why this pattern is useful

- `@agentsy/orchestrator/agent` gives you a reusable multi-step loop rather than bespoke loop control.
- `@agentsy/core/recovery` lets you resume after interrupted stream execution.
- `@agentsy/core/tool-calls` standardizes tool-result message shaping.

For additional package context, see the [package catalog](../packages.md).
