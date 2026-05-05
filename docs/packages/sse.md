# `@agentsy/sse`

- **Status:** Published
- **Role:** Server-sent-event parsing utilities

## Where it fits

This package handles low-level SSE parsing concerns before provider normalization or stream orchestration takes over.

## Available APIs

- `SSEParser`
- `parseSSEStream`

## Common neighbors

- `@agentsy/normalizers`
- `@agentsy/processor`

## Implementation example with neighbors

```ts
import { normalizeOpenAIResponseEvent } from '@agentsy/normalizers';
import { parseSSEStream } from '@agentsy/sse';

for await (const event of parseSSEStream(response.body)) {
  const normalized = normalizeOpenAIResponseEvent(event);
  console.log(normalized);
}
```
