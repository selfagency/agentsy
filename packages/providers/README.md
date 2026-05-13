# @agentsy/providers

Provider adapters, normalizers, and pipeline utilities for LLM stream processing.

## Overview

This package consolidates three previous packages into a unified providers API:

- `@agentsy/adapters` → `/adapters` subpath export
- `@agentsy/normalizers` → `/normalizers` subpath export
- `@agentsy/processor/pipeline` → `/pipeline` subpath export
- Universal client utilities → `/universal-client` subpath export

## Available Exports

```typescript
// Core provider pipeline
import { createPipeline, type PipelineOptions, type PipelinedStream } from '@agentsy/providers/pipeline';

// Normalized provider adapters
import {
  adaptToAnthropic,
  adaptToBedrock,
  adaptToCohere,
  adaptToDeepSeek,
  adaptToGemini,
  adaptToHfTgi,
  adaptToMistral,
  adaptToOpenAI,
  adaptToOllama,
  adaptOpenAIResponses,
  adaptToZai,
  type GenericAdapterOptions,
} from '@agentsy/providers/adapters';

// Provider-specific normalizers
import {
  normalizeAnthropicChunk,
  normalizeBedrockChunk,
  normalizeCohereChunk,
  normalizeDeepSeekChunk,
  normalizeGeminiChunk,
  normalizeHfTgiChunk,
  normalizeMistralChunk,
  normalizeOpenaiChunk,
  normalizeOllamaChunk,
  normalizeZaiChunk,
  type Normalizer,
  type NormalizerProvider,
} from '@agentsy/providers/normalizers';

// Universal client utilities
import { createUniversalClient, type UniversalClientOptions } from '@agentsy/providers/universal-client';
```

## Quick Start

### Using the Pipeline

```typescript
import { createPipeline, PipelinedStream } from '@agentsy/providers';
import { normalizeOpenaiChunk } from '@agentsy/providers/normalizers';

const stream = await fetch('/api/v1/chat/completions', {
  /* ... */
});

const pipelined = createPipeline(stream, {
  provider: 'openai',
  maxJsonDepth: 64,
  maxJsonKeys: 10000,

  // Optional: Processor options passed through
  parseThinkTags: true,
  scrubContextTags: true,
  knownTools: new Set(['weather', 'calculator']),
  modelId: 'gpt-4',
});

pipelined.addEventListener('delta', chunk => {
  console.log('Text:', chunk.content);
});

pipelined.addEventListener('tool_call', call => {
  console.log('Tool:', call.name, call.parameters);
});

pipelined.addEventListener('thinking', content => {
  console.log('Thinking:', content);
});
```

### Using Adapters Directly

```typescript
import { adaptToGemini, type GenericAdapterOptions } from '@agentsy/providers/adapters';

const adapter = adaptToGemini({
  maxInputLength: 262144,
  maxToolCallsPerMessage: 64,
  // ... other ProcessorOptions
});

const stream = adapter.transform(providerStream);
```

### Using Normalizers Only

```typescript
import { normalizeAnthropicChunk, type NormalizerProvider } from '@agentsy/providers/normalizers';

const normalizer: NormalizerProvider = 'anthropic';
const result = normalizeAnthropicChunk(rawChunk);
```

## API Reference

### Pipeline Options

Extends `ProcessorOptions` from `@agentsy/core/processor` with:

```typescript
interface PipelineOptions extends ProcessorOptions {
  provider: NormalizerProvider;
  /** Maximum nesting depth for SSE JSON payloads (default: 64) */
  maxJsonDepth?: number;
  /** Maximum number of keys in SSE JSON payloads (default: 10000) */
  maxJsonKeys?: number;
}
```

### Supported Providers

All normalizers support these providers:

| Provider           | Normalizer                       | Adapter                 |
| ------------------ | -------------------------------- | ----------------------- |
| `openai`           | ✅ normalizeOpenaiChunk          | ✅ adaptToOpenAI        |
| `anthropic`        | ✅ normalizeAnthropicChunk       | ✅ adaptToAnthropic     |
| `gemini`           | ✅ normalizeGeminiChunk          | ✅ adaptToGemini        |
| `bedrock`          | ✅ normalizeBedrockChunk         | ✅ adaptToBedrock       |
| `cohere`           | ✅ normalizeCohereChunk          | ✅ adaptToCohere        |
| `mistral`          | ✅ normalizeMistralChunk         | ✅ adaptToMistral       |
| `ollama`           | ✅ normalizeOllamaChunk          | ✅ adaptToOllama        |
| `deepseek`         | ✅ normalizeDeepSeekChunk        | ✅ adaptToDeepSeek      |
| `zai`              | ✅ normalizeZaiChunk             | ✅ adaptToZai           |
| `hftgi`            | ✅ normalizeHfTgiChunk           | ✅ adaptToHfTgi         |
| `openai-responses` | ✅ normalizeOpenaiResponsesChunk | ✅ adaptOpenAIResponses |

## Migration Guide

### From `@agentsy/processor/pipeline`

```diff
- import { createPipeline, type PipelineOptions } from '@agentsy/processor/pipeline';

+ import { createPipeline, type PipelineOptions } from '@agentsy/providers/pipeline';
```

The API is **identical** - only the import path changed.

### From `@agentsy/adapters`

```diff
- import { adaptToGemini } from '@agentsy/adapters';

+ import { adaptToGemini } from '@agentsy/providers/adapters';
```

All adapters are exported from `/adapters` subpath.

### From `@agentsy/normalizers`

```diff
- import { normalizeOpenaiChunk } from '@agentsy/normalizers';

+ import { normalizeOpenaiChunk } from '@agentsy/providers/normalizers';
```

All normalizers are exported from `/normalizers` subpath.

## Architecture

```
@agentsy/providers
├── /adapters          # Provider-specific stream transformations
│   ├── generic.ts     # Generic adapter utilities
│   ├── anthropic.ts   # Anthropic adapter
│   ├── bedrock.ts     # AWS Bedrock adapter
│   ├── cohere.ts      # Cohere adapter
│   ├── deepseek.ts    # DeepSeek adapter
│   ├── gemini.ts      # Google Gemini adapter
│   ├── openai.ts      # OpenAI adapter
│   └── ...
├── /normalizers      # Provider-specific chunk normalizers
│   ├── openai.ts      # OpenAI normalization
│   ├── anthropic.ts   # Anthropic normalization
│   ├── gemini.ts      # Gemini normalization
│   └── ...
├── /pipeline         # High-level pipeline orchestration
│   ├── createPipeline.ts
│   └── transform.ts
└── /universal-client # Generic provider client utilities
    └── index.ts
```

## Relationships with Other Packages

- **@agentsy/core**: Exports `ProcessorOptions`, `StreamChunk`, and processor utilities
- **@agentsy/integration**: Integration tests validate cross-package functionality
- **@agentsy/runtime**: Uses pipelines in runtime orchestrations

## Error Handling

All adapters and normalizers throw `PipelineError` with contextual information:

```typescript
import { createPipeline } from '@agentsy/providers/pipeline';

try {
  const pipeline = createPipeline(stream, { provider: 'openai' });
} catch (error) {
  if (error instanceof PipelineError) {
    console.error('Pipeline error:', error.message, { cause: error.cause });
  }
}
```

## Advanced Usage

### Custom Normalizers

```typescript
import { type Normalizer } from '@agentsy/providers/normalizers';

const customNormalizer: Normalizer = (data): { chunk: StreamChunk } | null => {
  if (typeof data !== 'object' || data === null) return null;
  // Custom normalization logic
  return {
    chunk: {
      /* ... */
    },
  };
};
```

### Pipeline Composition

```typescript
import { createPipeline } from '@agentsy/providers/pipeline';
import { TransformStream } from 'web/stream';

const customTransform = new TransformStream({
  transform(chunk, controller) {
    // Custom transformation
    controller.enqueue(chunk);
  },
});

createPipeline(stream, {
  provider: 'openai',
  // Note: transforms are not documented in current PipelineOptions interface
  // Add to interface if needed
});
```

## Testing

The package includes comprehensive tests:

```bash
pnpm test              # Run all tests
pnpm test:coverage     # Run tests with coverage
```

Integration tests in `@agentsy/integration` validate cross-package pipelines.

## Contributing

When adding new provider support:

1. Add normalizer to `/normalizers/your-provider.ts`
2. Add adapter to `/adapters/your-provider.ts`
3. Add tests for both normalizer and adapter
4. Update provider list in documentation
5. Add integration test in `@agentsy/integration`

## License

MIT
