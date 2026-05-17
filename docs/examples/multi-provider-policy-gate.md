# Multi-provider policy gate (intermediate)

This example shows a policy workflow that can switch providers while keeping one downstream decision contract:

1. Pick provider stream source at runtime.
2. Normalize provider-specific chunks.
3. Validate one shared schema.
4. Execute an action only when policy conditions pass.

## Packages used

```bash
npm install @agentsy/providers
```

## Illustrative implementation

```ts
import { applyDecisionAction, runStructuredDecisionFromRawStream } from '@agentsy/providers/adapters';
import { normalizeAnthropicEvent, normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';

type PolicyDecision = {
  shouldEscalate: boolean;
  queue: 'security' | 'payments' | 'platform';
  reason: string;
  confidence: number;
};

const policySchema = {
  type: 'object',
  required: ['shouldEscalate', 'queue', 'reason', 'confidence'],
  properties: {
    shouldEscalate: { type: 'boolean' },
    queue: { type: 'string', enum: ['security', 'payments', 'platform'] },
    reason: { type: 'string', minLength: 1 },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  }
} as const;

async function* streamOpenAI(prompt: string): AsyncGenerator<unknown> {
  // Replace with provider SDK stream.
  yield* fetchOpenAIChunks(prompt);
}

async function* streamAnthropic(prompt: string): AsyncGenerator<unknown> {
  // Replace with provider SDK stream.
  yield* fetchAnthropicEvents(prompt);
}

async function runPolicyGate(provider: 'openai' | 'anthropic', prompt: string): Promise<void> {
  const source = provider === 'openai' ? streamOpenAI(prompt) : streamAnthropic(prompt);
  const normalize = provider === 'openai' ? normalizeOpenAIChatChunk : normalizeAnthropicEvent;

  const decision = await runStructuredDecisionFromRawStream<unknown, PolicyDecision>({
    source,
    normalize: raw => normalize(raw),
    schema: policySchema
  });

  if (!decision.success) {
    throw new Error(`Policy decision failed schema validation: ${decision.errors.join('; ')}`);
  }

  await applyDecisionAction(decision.decision, {
    shouldAct: value => value.shouldEscalate && value.confidence >= 0.8,
    onSkip: value => {
      console.log('No escalation required:', value.reason);
    },
    action: async value => {
      await enqueueIncident(value.queue, value.reason);
    }
  });
}
```

## Why this pattern is useful

- You can change providers without rewriting downstream business logic.
- The schema gate protects automation from malformed model output.
- `applyDecisionAction` keeps action policy explicit and reusable.
