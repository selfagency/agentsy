# All-tooling end-to-end workflow (showcase)

This example demonstrates a single end-to-end architecture that combines the full Agentsy stack in one flow:

1. Parse SSE from a model provider response.
2. Normalize provider payloads into a shared stream shape.
3. Process streaming output (thinking, text, and tool calls).
4. Validate structured decision payloads.
5. Run a multi-step tool loop.
6. Capture recovery state and build continuation prompts on interruption.
7. Project events into conversation state.
8. Convert event streams for AG-UI consumers.
9. Render plain text output for CLI/operator workflows.

## Packages used

```bash
npm install @agentsy/core @agentsy/providers @agentsy/orchestrator/agent @agentsy/ag-ui @agentsy/renderers @agentsy/ui
```

## Illustrative implementation

```ts
import { applyDecisionAction, runStructuredDecisionFromRawStream } from '@agentsy/providers/adapters';
import { createAgentLoop, hasNoToolCalls, isStepCount } from '@agentsy/orchestrator/agent';
import { toAgUiStream } from '@agentsy/ag-ui';
import { normalizeOpenAIResponseEvent } from '@agentsy/providers/normalizers';
import { LLMStreamProcessor, createProcessorEventAdapter } from '@agentsy/core/processor';
import { buildContinuationPrompt, captureStreamState } from '@agentsy/core/recovery';
import { createPlainTextRenderer } from '@agentsy/renderers';
import { parseSSEStream } from '@agentsy/core/sse';
import { validateJsonSchema } from '@agentsy/core/structured';
import { buildToolResultMessage } from '@agentsy/core/tool-calls';
import { createConversationStoreFromProcessor } from '@agentsy/ui';

type SecurityDecision = {
  shouldBlock: boolean;
  targetIp: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
};

const decisionSchema = {
  type: 'object',
  required: ['shouldBlock', 'targetIp', 'reason', 'severity', 'evidence'],
  properties: {
    shouldBlock: { type: 'boolean' },
    targetIp: { type: 'string' },
    reason: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    evidence: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
} as const;

async function* executeProviderStream(messages: Array<{ role: string; content: string }>) {
  const response = await fetch('https://api.example.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      stream: true,
      messages,
    }),
  });

  if (!response.body) {
    throw new Error('Provider response did not include a body.');
  }

  const textStream = response.body.pipeThrough(new TextDecoderStream());

  // 1) SSE parsing + 2) provider normalization
  for await (const sseEvent of parseSSEStream(textStream)) {
    if (sseEvent.data === '[DONE]') {
      return;
    }

    try {
      const parsed = JSON.parse(sseEvent.data) as unknown;
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

async function runFullWorkflow(): Promise<void> {
  // 3) processor + 7) conversation state + 8) AG-UI + 9) rendering
  const processor = new LLMStreamProcessor({
    parseThinkTags: true,
    knownTools: new Set(['geo_lookup', 'reputation_check', 'dns_block']),
  });

  const bridge = createConversationStoreFromProcessor(processor, {
    conversationId: 'security-ops-demo',
  });

  const processorEvents = createProcessorEventAdapter(processor);
  const agUiStream = toAgUiStream(processorEvents.stream);
  const renderer = createPlainTextRenderer({ showThinking: false });

  void (async () => {
    for await (const event of agUiStream) {
      // Forward AG-UI events to your transport layer (WebSocket/SSE/etc.)
      emitToAgUiClients(event);
    }
  })();

  // 5) multi-step tool loop
  const loop = createAgentLoop({
    execute: executeWithContinuation,
    stopWhen: [hasNoToolCalls(), isStepCount(6)],
    buildToolResultMessages: async toolCalls => {
      const messages = [];
      for (const call of toolCalls) {
        const toolResult = await runTool(call.name, call.parameters);
        messages.push(buildToolResultMessage(call, toolResult));
      }
      return messages;
    },
  });

  async function* executeWithContinuation(messages: Array<{ role: string; content: string }>) {
    try {
      for await (const chunk of executeProviderStream(messages)) {
        const output = processor.process(chunk);
        if (output.content) {
          renderer.write(output);
        }
        yield* output.parts;
      }
      const finalOutput = processor.flush();
      renderer.write(finalOutput);
    } catch (_error) {
      // 6) recovery + continuation
      const snapshot = captureStreamState(processor);
      const continuationMessages = buildContinuationPrompt(snapshot, { provider: 'openai' });
      for await (const chunk of executeProviderStream([...messages, ...continuationMessages])) {
        const output = processor.process(chunk);
        if (output.content) {
          renderer.write(output);
        }
        yield* output.parts;
      }
      renderer.write(processor.flush());
    }
  }

  const initialMessages = [
    {
      role: 'user',
      content: 'Analyze current telemetry and decide whether to block malicious IPs. Use tools before final decision.',
    },
  ];

  for await (const part of loop.run(initialMessages)) {
    if (part.type === 'text') {
      // Optional live sink for text deltas
      process.stdout.write(part.text);
    }
  }

  // 4) structured validation and action gating
  const decisionText =
    bridge.store
      .getState()
      .messages.at(-1)
      ?.parts.filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n') ?? '';

  const decision = validateJsonSchema<SecurityDecision>(decisionText, decisionSchema);
  if (!decision.success) {
    throw new Error(`Decision payload invalid: ${decision.errors.join('; ')}`);
  }

  await applyDecisionAction(decision.data, {
    shouldAct: value => value.shouldBlock,
    onSkip: value => {
      console.log('No DNS block required:', value.reason);
    },
    action: async value => {
      await updateRemoteDnsBlocklist(value.targetIp, {
        reason: value.reason,
        severity: value.severity,
        evidence: value.evidence,
      });
    },
  });

  bridge.dispose();
}

// Alternate low-boilerplate path when raw-stream + schema gate is enough:
async function runSimplePath(rawSource: AsyncIterable<unknown>) {
  const simpleDecision = await runStructuredDecisionFromRawStream<unknown, SecurityDecision>({
    source: rawSource,
    normalize: event => {
      const normalized = normalizeOpenAIResponseEvent(event);
      return normalized ? normalized.chunk : null;
    },
    schema: decisionSchema,
  });

  if (simpleDecision.success) {
    await applyDecisionAction(simpleDecision.decision, {
      shouldAct: value => value.shouldBlock,
      action: async value => updateRemoteDnsBlocklist(value.targetIp, value),
    });
  }
}
```

## Why this pattern is useful

- `@agentsy/core/sse` + `@agentsy/providers/normalizers` standardize ingestion from provider streams.
- `@agentsy/core/processor` centralizes streaming orchestration and event emission.
- `@agentsy/orchestrator/agent` handles iterative tool loops with explicit stop conditions.
- `@agentsy/core/recovery` gives continuity when streams fail or disconnect.
- `@agentsy/ui` and `@agentsy/ag-ui` let the same backend flow power UI/state consumers.
- `@agentsy/providers/adapters` + `@agentsy/core/structured` reduce boilerplate in decision-gated automations.

For package-level details, see the [API index](../api.md) and [package catalog](../packages.md).
