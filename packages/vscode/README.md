# @agentsy/vscode

Unified VS Code integration library for Language Model Chat Providers built on the `@agentsy/*` monorepo packages.

## Status

- Published package: available on npm as `@agentsy/vscode`
- Repository development baseline: Node.js 22+

## Features

- **ApiKeyManager** — Centralized secrets management with VS Code SecretStorage
- **BaseLanguageModelChatProvider** — Abstract provider template with processor integration
- **ChatResponseStream renderers** — Thinking progress display, tool execution feedback, cancellation support
- **UsageStatusBar** — Quota tracking UI with configurable windows
- **McpServerRegistry** — MCP server definition pattern
- **SettingsLoader** — Typed configuration with schema validation
- **Message Conversion** — Role and message format conversion
- **Error Handling** — Standardized error mapping and recovery

## Installation

```bash
npm install @agentsy/vscode vscode
```

Dual module support is available:

- ESM: `import { createVSCodeAgentLoop } from '@agentsy/vscode'`
- CommonJS: `const { createVSCodeAgentLoop } = require('@agentsy/vscode')`

**Requirements**: Node.js 18+, TypeScript 5.0+ (if using TypeScript)

## Development

```bash
cd packages/vscode
pnpm build
pnpm check-types
pnpm lint
pnpm test
```

From repository root:

```bash
pnpm check-types
pnpm test
pnpm lint
```

## Quick Start

### 1. Create a Custom Provider

```typescript
import { BaseLanguageModelChatProvider, type ProviderConfig } from "@agentsy/vscode";

export class MyLanguageModelChatProvider extends BaseLanguageModelChatProvider {
  constructor(context: ExtensionContext) {
    super(context, {
      providerId: "my-provider",
      vendor: "MyVendor",
      family: "MyFamily",
      displayName: "My Provider",
      maxInputTokens: 4096,
      supportedCapabilities: ["thinking", "tool-calls"],
    });
  }

  protected async buildRequest(
    messages: ChatMessage[],
    request: LanguageModelChatRequest,
  ): Promise<ProviderApiRequest> {
    // Convert VS Code messages to your provider's API format
    return {
      url: "https://api.example.com/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: {
        model: request.model?.id,
        messages,
        stream: true,
      },
    };
  }

  protected async *normalizeStream(
    response: AsyncIterable<ProviderStreamChunk>,
  ): AsyncIterable<LanguageModelChatResponseChunk> {
    for await (const chunk of response) {
      const text = extractText(chunk); // provider-specific extraction
      if (!text) continue;
      yield {
        part: { value: text },
      } as LanguageModelChatResponseChunk;
    }
  }

  protected mapErrorToCode(error: unknown): string {
    // Map provider-specific errors to standard codes
    if (error instanceof MyProviderError) {
      if (error.code === "AUTH_FAILED") return "invalid_api_key";
      if (error.code === "RATE_LIMIT") return "rate_limited";
    }
    return "internal_error";
  }
}
```

### 2. Create a Normalizer

Normalizers convert provider-specific streaming chunks to the standard StreamChunk format:

```typescript
import { type StreamChunk } from "@agentsy/processor";

export async function* normalizeMyProviderStream(
  response: AsyncIterable<MyProviderChunk>,
): AsyncIterable<StreamChunk> {
  for await (const chunk of response) {
    yield {
      content: chunk.text,
      thinking: chunk.thinking,
      tool_calls: chunk.tool_calls?.map((tc) => ({
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

### 3. Integrate with processor packages

Use `LLMStreamProcessor` to handle tool accumulation and thinking parsing:

```typescript
import { LLMStreamProcessor } from "@agentsy/processor";

const processor = new LLMStreamProcessor({
  accumulateNativeToolCalls: true,
  parseThinkTags: true,
  onWarning: (message) => {
    console.warn("Warning:", message);
  },
});

processor.on("tool_call", (call) => {
  console.log("Tool called:", call);
});
processor.on("tool_call_delta", (delta) => {
  console.log("Tool delta:", delta);
});

for await (const chunk of normalizeMyProviderStream(response)) {
  const output = processor.process(chunk);
  // Handle output parts
}
```

### 4. Setup API Key Management

```typescript
import { ApiKeyManager } from "@agentsy/vscode";

const apiKeyManager = new ApiKeyManager(context, {
  secretKey: "MY_PROVIDER_API_KEY",
  contextKey: "myProvider.hasApiKey",
  displayName: "My Provider API Key",
});

// Register command to set API key
commands.registerCommand("myProvider.setApiKey", () => apiKeyManager.setApiKey());

// Get API key when needed
const key = await apiKeyManager.getApiKey();

// Listen for changes
const apiKeySubscription = apiKeyManager.onDidChangeApiKey((event, newKey) => {
  if (event !== "updated") return;
  // Reconnect provider with new key
});

// Dispose on extension shutdown
context.subscriptions.push(apiKeySubscription);
```

### 5. Track Usage with Status Bar

```typescript
import { UsageStatusBar } from "@agentsy/vscode";

const statusBar = new UsageStatusBar(context, {
  displayName: "My Provider Usage",
  quotaDataSource: {
    async getQuota() {
      const usage = await myProvider.getUsage();
      return {
        used: usage.tokens_used,
        total: usage.limit,
        unit: "tokens",
        window: "hourly",
        percentUsed: usage.tokens_used / usage.limit,
      };
    },
  },
  warningThreshold: 0.8,
  errorThreshold: 0.95,
});

await statusBar.show();
```

Map core usage into VS Code usage shape with `mapUsageToVSCode`:

```typescript
import { mapUsageToVSCode } from "@agentsy/vscode";

const usage = mapUsageToVSCode({ inputTokens: 120, outputTokens: 45 });
// => { promptTokens: 120, completionTokens: 45 }
```

Tool-call lifecycle helpers for provider integrations:

```typescript
import {
  ToolCallDeltaAccumulator,
  accumulateToolCallDeltas,
  toVSCodeToolCallPart,
} from "@agentsy/vscode";

const accumulator = new ToolCallDeltaAccumulator();
accumulateToolCallDeltas(accumulator, deltaPart);
const finalized = accumulator.finalize({ repairIncomplete: true });

const toolCallPartPayload = toVSCodeToolCallPart(toolCallOutputPart);
```

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
import { normalizeZAiChunk } from "@agentsy/normalizers";
import { createZAiInlineToolCallParser, LLMStreamProcessor } from "@agentsy/processor";

const processor = new LLMStreamProcessor({
  toolCallParsers: [createZAiInlineToolCallParser()],
});

for await (const raw of zaiStream) {
  const normalized = normalizeZAiChunk(raw);
  if (!normalized) continue;
  const output = processor.process(normalized.chunk);
  // Consume output.parts
}

const final = processor.flush();
if (final.done) {
  console.log("Stream complete");
}
```

### MCP provider helper

```typescript
import { createMcpServerDefinitionProvider } from "@agentsy/vscode";

const provider = createMcpServerDefinitionProvider({
  servers: [
    {
      name: "zai-mcp",
      command: "node",
      args: ["dist/server.js"],
      enabledSettingKey: "mcp.zai.enabled",
      apiKeyEnvVar: "ZAI_API_KEY",
    },
  ],
  settings: settingsLoader,
  getApiKey: async () => apiKeyManager.getApiKey(),
});

const servers = await provider.provide();
for (const server of servers) {
  registry.register(server);
}
```

### Mistral

```typescript
import { normalizeMistralChunk } from "@agentsy/normalizers";

for await (const chunk of mistralStream) {
  const normalized = normalizeMistralChunk(chunk);
  if (!normalized) continue;
  processor.process(normalized.chunk);
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
pnpm check-types

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
├── Quota adapter utilities    ← Multi-window quota normalization helpers
├── McpServerRegistry          ← MCP server settings registry
├── createMcpServerDefinitionProvider ← MCP provider API helper
└── SettingsLoader            ← Config validation

↓ (depends on)

@agentsy/processor + @agentsy/normalizers
├── LLMStreamProcessor         ← Tool accumulation, thinking parsing
├── StreamChunk               ← Standard streaming format
└── Normalizers               ← Provider-specific converters (including normalizeZAiChunk)

↓ (used by)

Provider Extensions (Opilot, Z.ai, Mistral)
├── Normalizers               ← Provider-specific StreamChunk generators
├── LanguageModelChatProvider ← Extends BaseLanguageModelChatProvider
└── Integration               ← Uses library abstractions
```

## Testing

The library includes test fixtures for mocking VS Code APIs:

```typescript
import {
  createChunkNormalizerStub,
  createMockApiKeyManager,
  createMockRendererHandle,
} from "@agentsy/vscode";

const apiKeyManager = createMockApiKeyManager("demo-key");
const renderer = createMockRendererHandle();
const normalize = createChunkNormalizerStub<{ text: string }>((event) => ({
  content: event.text,
}));
```

## License

GPL-3.0-or-later

## See Also

- [@agentsy/processor](https://github.com/selfagency/agentsy/tree/main/packages/processor) — Stream processor
- [@agentsy/normalizers](https://github.com/selfagency/agentsy/tree/main/packages/normalizers) — Provider normalizers
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [MCP Protocol](https://modelcontextprotocol.io/)
