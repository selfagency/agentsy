# `@agentsy/adapters`

- **Status:** Published
- **Role:** Integration-oriented wrappers around the processing pipeline

## Where it fits

`@agentsy/adapters` helps package the lower-level stream-processing stack for integration surfaces that want less wiring and more convention.

## Key exports

- `createGenericAdapter`
- `processStream`
- Mistral adapter helpers
- OpenAI-compatible adapter helpers

## Available APIs

- Generic adapter creation and streaming utilities
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
import { createGenericAdapter } from '@agentsy/adapters';
import { normalizeOpenAICompatibleChunk } from '@agentsy/normalizers';
import { processStream } from '@agentsy/adapters';

for await (const output of processStream(normalizedStream, { parseThinkTags: true })) {
  console.log(output.content);
}

const adapter = createGenericAdapter(
  {
    onContent: text => process.stdout.write(text),
    onDone: () => console.log('\nDone'),
  },
  { parseThinkTags: true, scrubContextTags: false },
);

for await (const rawChunk of streamFromProvider) {
  await adapter.write(normalizeOpenAICompatibleChunk(rawChunk));
}

await adapter.end();
```

## Notes

This package is about integration boundaries, not provider normalization itself. Keep the responsibilities separate unless chaos is somehow the feature.
