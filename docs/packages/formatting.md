# `@agentsy/core/formatting`

- **Status:** Published subpath export from `@agentsy/core`
- **Role:** Safe display-oriented formatting helpers

## Key exports

- `appendToBlockquote`
- `formatXmlLikeResponseForDisplay`
- `sanitizeNonStreamingModelOutput`

## Available APIs

- blockquote conversion for thinking content
- XML-like response formatting for display
- non-streaming output sanitization

## Where it fits

This package is for presentation-safe string shaping after parsing but before rendering to the user.

## Common neighbors

- `@agentsy/renderers`
- `@agentsy/ui`
- `@agentsy/vscode`

## Implementation example with neighbors

```ts
import { appendToBlockquote, sanitizeNonStreamingModelOutput } from '@agentsy/core/formatting';
import { createPlainTextRenderer } from '@agentsy/renderers';

const renderer = createPlainTextRenderer({
  output: text => process.stdout.write(text)
});
const cleanText = sanitizeNonStreamingModelOutput(rawModelOutput);

await renderer.write(appendToBlockquote(cleanText));
await renderer.end();
```
