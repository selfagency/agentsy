# @agentsy/vscode

Unified VS Code integration library for Language Model Chat Providers with **@agentsy/core support**.

## Features

- **ApiKeyManager** — Centralized secrets management with VS Code SecretStorage
- **BaseLanguageModelChatProvider** — Abstract provider template with [@agentsy/core](../parser#readme) processor integration
- **ChatResponseStream renderers** — Thinking progress display, tool execution feedback, cancellation support
- **UsageStatusBar** — Quota tracking UI with configurable windows
- **McpServerRegistry** — MCP server definition pattern
- **SettingsLoader** — Typed configuration with schema validation
- **Message Conversion** — Role and message format conversion
- **Error Handling** — Standardized error mapping and recovery

## Installation

```bash
npm install @agentsy/vscode @agentsy/core vscode
```

**Requirements**: Node.js 18+, TypeScript 5.0+ (if using TypeScript)

## Quick Start

### 1. Create a Custom Provider

```typescript
import { BaseLanguageModelChatProvider, type ProviderConfig } from '@agentsy/vscode';

export class MyLanguageModelChatProvider extends BaseLanguageModelChatProvider {
  constructor(context: ExtensionContext) {
    super(context, {
      providerId: 'my-provider',
      vendor: 'MyVendor',
      family: 'MyFamily',
      displayName: 'My Provider',
      maxInputTokens: 4096,
      supportedCapabilities: ['thinking', 'tool-calls'],
    });
  }

  protected async buildRequest(
    messages: ChatMessage[],
    request: LanguageModelChatRequest,
  ): Promise<ProviderApiRequest> {
    // Convert VS Code messages to your provider's API format
    return {
      model: request.model.id,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };
  }

  protected normalizeStream(
    response: AsyncIterable<ProviderStreamChunk>,
  ): AsyncIterable<LanguageModelChatResponseChunk> {
    // Normalize provider stream chunks to LLMStreamProcessor format
    return normalizeMyProviderStream(response);
  }

  protected mapErrorToCode(error: unknown): string {
    // Map provider-specific errors to standard codes
    if (error instanceof MyProviderError) {
      if (error.code === 'AUTH_FAILED') return 'invalid_api_key';
      if (error.code === 'RATE_LIMIT') return 'rate_limited';
    }
    return 'internal_error';
  }
}
```

### 2. Create a Normalizer

Normalizers convert provider-specific streaming chunks to the standard StreamChunk format:

```typescript
import { type StreamChunk } from '@agentsy/core';

export async function* normalizeMyProviderStream(response: AsyncIterable<MyProviderChunk>): AsyncIterable<StreamChunk> {
  for await (const chunk of response) {
    yield {
      content: chunk.text,
      thinking: chunk.thinking,
      tool_calls: chunk.tool_calls?.map(tc => ({
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      })),
      done: chunk.finish_reason !== null,
      usage: chunk.usage && {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      },
      finishReason: chunk.finish_reason,
    };
  }
}
```

### 3. Integrate with llm-stream-parser 0.3.1

Use `LLMStreamProcessor` to handle tool accumulation and thinking parsing:

```typescript
import { LLMStreamProcessor } from '@agentsy/core';

const processor = new LLMStreamProcessor({
  accumulateNativeToolCalls: true,
  parseThinkTags: true,
  onFinish: output => {
    console.log('Stream finished:', output);
  },
  onStep: part => {
    if (part.type === 'tool_call') {
      console.log('Tool called:', part.call);
    }
  },
  onToolCallDelta: delta => {
    console.log('Tool delta:', delta);
  },
  onWarning: message => {
    console.warn('Warning:', message);
  },
});

for await (const chunk of normalizeMyProviderStream(response)) {
  const output = processor.process(chunk);
  // Handle output parts
}
```

### 4. Setup API Key Management

```typescript
import { ApiKeyManager } from '@agentsy/vscode';

const apiKeyManager = new ApiKeyManager(context, {
  secretKey: 'MY_PROVIDER_API_KEY',
  contextKey: 'myProvider.hasApiKey',
  displayName: 'My Provider API Key',
});

// Register command to set API key
commands.registerCommand('myProvider.setApiKey', () => apiKeyManager.setApiKey());

// Get API key when needed
const key = await apiKeyManager.getApiKey();

// Listen for changes
apiKeyManager.onDidChangeApiKey(newKey => {
  // Reconnect provider with new key
});
```

### 5. Track Usage with Status Bar

```typescript
import { UsageStatusBar } from '@agentsy/vscode';

const statusBar = new UsageStatusBar(context, {
  displayName: 'My Provider Usage',
  quotaDataSource: {
    async getQuota() {
      const usage = await myProvider.getUsage();
      return {
        used: usage.tokens_used,
        total: usage.limit,
        unit: 'tokens',
        window: 'hourly',
        percentUsed: usage.tokens_used / usage.limit,
      };
    },
  },
  warningThreshold: 0.8,
  errorThreshold: 0.95,
});

await statusBar.initialize();
```

## API Documentation

See [docs/](./docs/) for complete API documentation, migration guides, and examples.

## Processor Integration Examples

### Opilot (Ollama)

```typescript
export async function* normalizeOllamaChatChunk(
  response: AsyncIterable<OllamaChatResponse>,
): AsyncIterable<StreamChunk> {
  for await (const chunk of response) {
    yield {
      content: chunk.message.content,
      done: chunk.done,
      usage:
        chunk.done && chunk.prompt_eval_count
          ? {
              inputTokens: chunk.prompt_eval_count,
              outputTokens: chunk.eval_count,
              totalTokens: chunk.prompt_eval_count + (chunk.eval_count || 0),
            }
          : undefined,
    };
  }
}
```

### Z.ai

```typescript
export async function* normalizeZAiChunk(response: AsyncIterable<ZAiStreamEvent>): AsyncIterable<StreamChunk> {
  for await (const event of response) {
    if (event.type === 'content_block_delta') {
      yield {
        content: event.delta.text,
      };
    } else if (event.type === 'message_stop') {
      yield {
        done: true,
        usage: {
          inputTokens: event.message.usage.input_tokens,
          outputTokens: event.message.usage.output_tokens,
        },
      };
    }
  }
}
```

### Mistral

```typescript
export async function* normalizeMistralStreamEvent(
  response: AsyncIterable<MistralStreamEvent>,
): AsyncIterable<StreamChunk> {
  for await (const event of response) {
    if (event.data.type === 'content_block_delta') {
      yield {
        content: event.data.delta.text,
      };
    } else if (event.data.type === 'message_stop') {
      yield {
        done: true,
        finishReason: event.data.finish_reason,
      };
    }
  }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build library
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm coverage

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Architecture

```text
@agentsy/vscode (library)
├── ApiKeyManager              ← SecretStorage integration
├── BaseLanguageModelChatProvider ← Template with processor integration
├── Message Conversion         ← Role/message format converters
├── Error Handling             ← Standard error codes
├── UsageStatusBar             ← Quota UI
├── McpServerRegistry          ← MCP server patterns
└── SettingsLoader            ← Config validation

↓ (depends on)

@agentsy/core 0.3.1
├── LLMStreamProcessor         ← Tool accumulation, thinking parsing
├── StreamChunk               ← Standard streaming format
└── Normalizers               ← Provider-specific converters

↓ (used by)

Provider Extensions (Opilot, Z.ai, Mistral)
├── Normalizers               ← Provider-specific StreamChunk generators
├── LanguageModelChatProvider ← Extends BaseLanguageModelChatProvider
└── Integration               ← Uses library abstractions
```

## Testing

The library includes test fixtures for mocking VS Code APIs:

```typescript
import { createMockVSCode, createMockChatRequest } from '@agentsy/vscode/test';

const mockVSCode = createMockVSCode();
const mockRequest = createMockChatRequest();
```

## Migration Guides

- [Opilot Migration](./docs/migration-opilot.md)
- [Z-models-vscode Migration](./docs/migration-z-models.md)
- [Mistral-models-vscode Migration](./docs/migration-mistral.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT

## See Also

- [@agentsy/core](https://github.com/selfagency/llm-stream-parser) — Core streaming parser
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [MCP Protocol](https://modelcontextprotocol.io/)
