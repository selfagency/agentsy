# `@agentsy/renderers`

- **Status:** Published
- **Role:** Text-oriented rendering surface and shared renderer primitives

## Where it fits

`@agentsy/renderers` projects processed conversation events into human-readable output.

## Current documented surface

- `createPlainTextRenderer`
- shared renderer utilities and types

## Available APIs

- Plain-text rendering from the package root
- Shared renderer contracts used by CLI, Ink, and streaming Markdown implementations in source

## Source-level implementations to know about

The package source also contains CLI, Ink, and streaming Markdown implementations. They are useful for contributors and future evolution, but the root package page only treats the root export surface as the current documented entry point.

## Use it when

- you need plain-text rendering today
- you are building or extending renderer surfaces in-repo

## Common neighbors

- Upstream: `@agentsy/core/processor`, `@agentsy/providers/normalizers`
- Adjacent: `@agentsy/ui`, `@agentsy/vscode`

## Implementation example with neighbors

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
import { LLMStreamProcessor } from '@agentsy/core/processor';
import { createPlainTextRenderer } from '@agentsy/renderers';

const processor = new LLMStreamProcessor({ parseThinkTags: true });
const renderer = createPlainTextRenderer({
  output: text => process.stdout.write(text)
});

processor.on('text', text => void renderer.write(text));

for await (const rawChunk of openAiStream) {
  processor.process(normalizeOpenAIChatChunk(rawChunk));
}

await renderer.end();
```

## Migration note

If you previously used historical renderer subpaths from `@selfagency/llm-stream-parser`, see the dedicated [migration guide](/migration/llm-stream-parser) for what maps cleanly and what does not.
