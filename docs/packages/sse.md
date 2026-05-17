# `@agentsy/core/sse`

- **Status:** Published subpath export from `@agentsy/core`
- **Role:** Server-sent-event parsing utilities

## Where it fits

This package handles low-level SSE parsing concerns before provider normalization or stream orchestration takes over.

## Available APIs

- `SSEParser`
- `parseSSEStream`

## Common neighbors

- `@agentsy/providers/normalizers`
- `@agentsy/core/processor`

## Implementation example with neighbors

```ts
import { normalizeOpenAIResponseEvent } from '@agentsy/providers/normalizers';
import { parseSSEStream } from '@agentsy/core/sse';

for await (const event of parseSSEStream(response.body)) {
  const normalized = normalizeOpenAIResponseEvent(event);
  console.log(normalized);
}
```
