# `@agentsy/core/thinking`

- **Status:** Published subpath export from `@agentsy/core`
- **Role:** Incremental reasoning-tag extraction

## Key export

- `ThinkingParser`

## Available APIs

- Parser construction and incremental parsing helpers on `ThinkingParser`

## Where it fits

Use this package when you need focused handling of model-specific `<think>` or reasoning-tag content without dragging in the rest of the stack.

## Common neighbors

- `@agentsy/core/processor`
- `@agentsy/renderers`
- `@agentsy/core/formatting`

## Implementation example with neighbors

```ts
import { sanitizeNonStreamingModelOutput } from '@agentsy/core/formatting';
import { ThinkingParser } from '@agentsy/core/thinking';

const parser = new ThinkingParser();

for await (const chunk of stream) {
  const [thinking, content] = parser.addContent(chunk);

  if (thinking) console.log('thinking:', thinking);
  if (content) console.log('content:', sanitizeNonStreamingModelOutput(content));
}
```
