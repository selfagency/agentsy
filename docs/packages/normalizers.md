# `@agentsy/providers/normalizers`

- **Status:** Published subpath export from `@agentsy/providers`
- **Role:** Provider-specific normalization into a shared stream vocabulary

## Where it fits

`@agentsy/providers/normalizers` is the compatibility layer between raw provider payloads and the rest of the Agentsy processing stack.

## Key exports

- `normalizeOpenAIChatChunk`
- `normalizeOpenAIResponseEvent`
- `normalizeAnthropicEvent`
- `normalizeGeminiChunk`
- `normalizeMistralChunk`
- `normalizeCohereEvent`
- `normalizeOllamaChatChunk`
- `normalizeOllamaGenerateChunk`
- `normalizeBedrockConverseEvent`
- `normalizeHuggingFaceTGIChunk`
- `normalizeDeepSeekChunk`
- `normalizeZAiChunk`
- OpenAI-compatible helpers

## Available APIs

- Provider-specific normalizers for Anthropic, Bedrock, Cohere, DeepSeek, Gemini, Hugging Face TGI, Mistral, Ollama, OpenAI, and Z.AI
- OpenAI-compatible provider detection and normalization helpers
- Shared normalizer types re-exported from the package

## Use it when

- you need one downstream pipeline to support multiple providers
- you want the rest of your code to stop caring about provider wire formats

## Common neighbors

- Downstream: `@agentsy/core/processor`, `@agentsy/providers/pipeline`
- Adjacent docs: [Stream processing flow](../architecture/stream-processing.md)

## Example

```ts
import { normalizeOpenAIChatChunk } from "@agentsy/providers/normalizers";

const normalized = normalizeOpenAIChatChunk(chunk);
```

## Implementation example with neighbors

```ts
import { normalizeOpenAIChatChunk } from "@agentsy/providers/normalizers";
import { LLMStreamProcessor } from "@agentsy/core/processor";

const processor = new LLMStreamProcessor({ parseThinkTags: true });

for await (const rawChunk of openAiStream) {
  processor.process(normalizeOpenAIChatChunk(rawChunk));
}

console.log(processor.accumulatedMessage.content);
```

## Notes

If your integration already emits a compatible internal event shape, you may not need this package directly. Most provider-facing code does.
