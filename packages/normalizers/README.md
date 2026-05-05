# @agentsy/normalizers

Provider-specific stream normalization adapters.

## Purpose

`@agentsy/normalizers` converts provider-native payloads into a consistent stream chunk shape.

## Role in Agentsy

This package sits between raw provider responses and `@agentsy/processor` so downstream logic can stay provider-agnostic.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when your application consumes multiple provider formats and you want a shared downstream event shape.

Typical neighbors:

- `@agentsy/processor` for orchestration
- `@agentsy/adapters` for integration packaging
- `@agentsy/vscode` in VS Code-specific flows

## API overview

- `normalizeOpenAIChatChunk`
- `normalizeOpenAIResponseEvent`
- `normalizeAnthropicEvent`
- `normalizeGeminiChunk`
- `normalizeMistralChunk`
- `normalizeCohereEvent`
- `normalizeOllamaChatChunk`
- `normalizeOllamaGenerateChunk`
- `normalizeBedrockConverseEvent`
- `normalizeDeepSeekChunk`
- `normalizeHuggingFaceTGIChunk`
- `normalizeZAiChunk`
- OpenAI-compatible helpers

## Usage

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
import { LLMStreamProcessor } from '@agentsy/processor';

const processor = new LLMStreamProcessor();

for await (const raw of openAiStream) {
  processor.process(normalizeOpenAIChatChunk(raw));
}
```

## Learn more

- [Package page](../../docs/packages/normalizers.md)
- [Stream processing](../../docs/architecture/stream-processing.md)

## Development

```bash
cd packages/normalizers
pnpm build
pnpm check-types
pnpm test
```
