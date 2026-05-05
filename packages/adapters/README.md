# @agentsy/adapters

Adapter helpers for model/provider integration boundaries.

## Purpose

`@agentsy/adapters` contains adapter utilities for integrating stream pipelines with provider-specific invocation surfaces.

## Role in Agentsy

Used as a bridge layer between provider I/O and normalized processing flow.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you want to package lower-level normalization and processing into a cleaner provider or application integration boundary.

Typical neighbors:

- `@agentsy/normalizers`
- `@agentsy/processor`
- `@agentsy/agent`

## API overview

- `createGenericAdapter`
- `processStream`
- Mistral adapter helpers
- OpenAI-compatible adapter helpers

## Usage

```ts
import { createGenericAdapter } from '@agentsy/adapters';
import { normalizeOpenAICompatibleChunk } from '@agentsy/normalizers';

const adapter = createGenericAdapter({
  normalizeChunk: normalizeOpenAICompatibleChunk,
  parseThinkTags: true,
});

for await (const part of adapter.process(source)) {
  console.log(part);
}
```

## Learn more

- `/docs/packages/adapters.md`

## Development

```bash
cd packages/adapters
pnpm build
pnpm check-types
pnpm test
```
