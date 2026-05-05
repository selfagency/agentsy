# `@agentsy/adapters`

- **Status:** Published
- **Role:** Integration-oriented wrappers around the processing pipeline

## Where it fits

`@agentsy/adapters` helps package the lower-level stream-processing stack for integration surfaces that want less wiring and more convention.

## Key exports

- `createGenericAdapter`
- `processStream`
- `processRawStream`
- `runStructuredDecisionFromRawStream`
- `applyDecisionAction`
- Mistral adapter helpers
- OpenAI-compatible adapter helpers

## Available APIs

- Generic adapter creation and streaming utilities
- Raw-stream normalization + processor orchestration helpers
- Structured decision orchestration helpers
- Side-effect gating helper for validated decisions
- Provider-oriented adapter helpers for Mistral and OpenAI-compatible surfaces

## Use it when

- you are packaging the processing pipeline behind a provider-facing or product-facing boundary
- you want consistent integration glue across multiple entry points

## Common neighbors

- Upstream: `@agentsy/normalizers`, `@agentsy/processor`
- Downstream: `@agentsy/vscode` and other product-specific integrations

## Example

```ts
import { createGenericAdapter } from '@agentsy/adapters';

const adapter = createGenericAdapter({
  onContent: text => process.stdout.write(text),
});
```

## Implementation example with neighbors

```ts
import { applyDecisionAction, createGenericAdapter, runStructuredDecisionFromRawStream } from '@agentsy/adapters';
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';

const schema = {
  type: 'object',
  required: ['shouldBlock', 'targetIp', 'reason', 'ttlSeconds', 'evidence'],
  properties: {
    shouldBlock: { type: 'boolean' },
    targetIp: { type: 'string' },
    reason: { type: 'string' },
    ttlSeconds: { type: 'number' },
    evidence: { type: 'array', items: { type: 'string' } },
  },
} as const;

const decision = await runStructuredDecisionFromRawStream<unknown, { shouldBlock: boolean }>({
  source: rawProviderStream,
  normalize: raw => {
    const normalized = normalizeOpenAIChatChunk(raw);
    return normalized ? normalized.chunk : null;
  },
  schema,
  processorOptions: { parseThinkTags: true },
});

if (decision.success) {
  await applyDecisionAction(decision.decision, {
    shouldAct: value => value.shouldBlock,
    action: async value => {
      await updateRemoteDns(value);
    },
  });
}

const adapter = createGenericAdapter(
  {
    onContent: text => process.stdout.write(text),
    onDone: () => console.log('\nDone'),
  },
  { parseThinkTags: true, scrubContextTags: false },
);

for await (const rawChunk of streamFromProvider) {
  const normalized = normalizeOpenAIChatChunk(rawChunk);
  if (!normalized) {
    continue;
  }
  await adapter.write(normalized.chunk);
}

await adapter.end();
```

## Notes

This package is about integration boundaries, not provider normalization itself. Keep the responsibilities separate unless chaos is somehow the feature.
