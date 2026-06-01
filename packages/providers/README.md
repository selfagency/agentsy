# @agentsy/providers

Provider adapters, normalizers, and pipeline utilities for LLM stream processing.

## Overview

This package provides a unified API for normalizing provider-specific streaming responses into the canonical `StreamChunk` format used across the agentsy ecosystem:

- **Normalizers** — Convert raw provider chunks into `StreamChunk`
- **Adapters** — Outbound message formatting (e.g. toMistralMessages)
- **Pipeline** — High-level streaming pipeline with auto-normalizer routing
- **Universal client** — Generic provider client with format conversion
- **Capability bridge** — Provider capability matching and selection

## Available Exports

```typescript
// Normalizers — convert raw provider chunks to StreamChunk
import {
  normalizeAnthropicEvent,
  normalizeBedrockConverseEvent,
  normalizeCohereEvent,
  normalizeDeepSeekChunk,
  normalizeGeminiChunk,
  normalizeHuggingFaceTGIChunk,
  normalizeMistralChunk,
  normalizeOllamaChatChunk,
  normalizeOllamaGenerateChunk,
  normalizeOpenAIChatChunk,
  normalizeOpenAICompatibleChunk,
  normalizeOpenAIResponseEvent,
  normalizeZAiChunk,
  type NormalizerResult,
} from "@agentsy/providers/normalizers";

// Adapters — outbound message formatting
import {
  createGenericAdapter,
  toMistralMessages,
  toOpenAICompatibleMessages,
  isOpenAICompatibleProvider,
} from "@agentsy/providers/adapters";

// Pipeline — high-level streaming pipeline
import { createPipeline, type PipelineOptions } from "@agentsy/providers/pipeline";

// Request path — provider routing + request handling
import { createRequestHandler, type RequestPathProvider } from "@agentsy/providers/request-path";

// Universal client — generic provider client
import { createUniversalClient, type UniversalClientConfig } from "@agentsy/providers/universal-client";

// Capability bridge — provider capability matching
import {
  matchCapabilities,
  filterProvidersByCapabilities,
  selectBestProvider,
  buildProviderCapabilityProfile,
  modelCapabilitiesToProviderRequirements,
} from "@agentsy/providers";
```

## Quick Start

### Using Normalizers

```typescript
import { normalizeOpenAIChatChunk } from "@agentsy/providers/normalizers";

for await (const rawChunk of responseStream) {
  const result = normalizeOpenAIChatChunk(rawChunk);
  if (result) {
    console.log("Content:", result.content);
    console.log("Thinking:", result.thinking);
    console.log("Done:", result.done);
  }
}
```

### Using the Pipeline

```typescript
import { createPipeline } from "@agentsy/providers/pipeline";

const pipeline = createPipeline(responseStream, {
  provider: "openai",
  maxJsonDepth: 64,
  maxJsonKeys: 10000,
  parseThinkTags: true,
  scrubContextTags: true,
  knownTools: new Set(["weather", "calculator"]),
  modelId: "gpt-4",
});

pipeline.addEventListener("delta", (chunk) => {
  console.log("Text:", chunk.content);
});
```

### Using Outbound Adapters

```typescript
import { toMistralMessages, type MistralOutboundMessage } from "@agentsy/providers/adapters";

const messages: MistralOutboundMessage[] = toMistralMessages(conversationHistory);
```

### Using the Request Path

```typescript
import { createRequestHandler } from "@agentsy/providers/request-path";

const handler = createRequestHandler({
  providers: [
    { id: "openai", baseUrl: "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY },
  ],
  model: "gpt-4",
});

const response = await handler.send({ messages: [{ role: "user", content: "Hello" }] });
```

## Supported Providers

| Provider           | Normalizer Function                      | Notes                                |
| ------------------ | ---------------------------------------- | ------------------------------------ |
| OpenAI             | `normalizeOpenAIChatChunk`               | Chat Completions API                 |
| OpenAI Responses   | `normalizeOpenAIResponseEvent`           | Responses API                        |
| OpenAI-Compatible  | `normalizeOpenAICompatibleChunk`         | Generic for DeepInfra, Groq, etc.    |
| Anthropic          | `normalizeAnthropicEvent`                | Messages API with content blocks     |
| Gemini             | `normalizeGeminiChunk`                   | Generate Content API                 |
| Bedrock            | `normalizeBedrockConverseEvent`          | AWS Bedrock Converse API             |
| Mistral            | `normalizeMistralChunk`                  | Chat API with thinking support       |
| Cohere             | `normalizeCohereEvent`                   | Chat API with tool plan              |
| Ollama             | `normalizeOllamaChatChunk`               | Chat API                             |
| Ollama Generate    | `normalizeOllamaGenerateChunk`           | Generate API                         |
| DeepSeek           | `normalizeDeepSeekChunk`                 | Chat API (OpenAI-compatible variant) |
| Hugging Face TGI   | `normalizeHuggingFaceTGIChunk`           | Text Generation Inference            |
| ZAI                | `normalizeZAiChunk`                      | ZAI API (OpenAI-compatible variant)  |

## Migration Guide

### From `@agentsy/processor/pipeline`

```diff
- import { createPipeline } from '@agentsy/processor/pipeline';
+ import { createPipeline } from '@agentsy/providers/pipeline';
```

### From `@agentsy/normalizers`

```diff
- import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
+ import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
```

## Architecture

```text
@agentsy/providers
├── /adapters            # Outbound message formatting + generic adapter
│   ├── generic.ts       # createGenericAdapter factory
│   ├── mistral.ts       # toMistralMessages
│   └── openai-compatible.ts  # toOpenAICompatibleMessages
├── /normalizers         # Inbound chunk normalization (12 providers)
│   ├── anthropic.ts
│   ├── bedrock.ts
│   ├── cohere.ts
│   ├── deepseek.ts
│   ├── gemini.ts
│   ├── hf-tgi.ts
│   ├── mistral.ts
│   ├── ollama.ts
│   ├── openai.ts
│   ├── openai-compatible.ts
│   ├── openai-responses.ts
│   └── zai.ts
├── /pipeline            # Streaming pipeline orchestration
├── /universal-client    # Generic provider client
├── capability-bridge.ts # Provider capability matching
└── request-path.ts      # Provider routing + request handling
```

## Relationships with Other Packages

- **@agentsy/core** — `StreamChunk`, `ProcessorOptions`, processor utilities
- **@agentsy/types** — `NativeToolCallDelta`, `UsageInfo`, shared type definitions
- **@agentsy/gateway** — Multi-provider routing, circuit-breaking, failover (transport layer)

## Error Handling

Normalizers return `undefined` for unrecognized or malformed chunks rather than throwing. This enables graceful degradation — unrecognized events are silently skipped.

The pipeline and request path throw descriptive errors for invalid configuration or unreachable providers.

## Testing

```bash
pnpm test              # Run all tests
pnpm coverage          # Run with coverage
pnpm check-types       # TypeScript type check
pnpm build             # Build all entry points
```

## Contributing

When adding new provider support:

1. Add normalizer to `src/normalizers/<provider>.ts`
2. Export from `src/normalizers/index.ts`
3. Add tests alongside the normalizer
4. Register in the pipeline's `NORMALIZERS` map if auto-routing is needed
5. Update the provider table in this README

## License

GPL-3.0-or-later
