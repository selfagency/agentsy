# `@agentsy/vscode`

- **Status:** Published
- **Role:** VS Code chat-provider integration, rendering, settings, usage, and MCP helpers

## Where it fits

`@agentsy/vscode` is the current flagship published integration package. It packages lower-level Agentsy processing patterns into a VS Code-focused surface for Language Model Chat Provider scenarios.

## Key exports

- `createVSCodeAgentLoop`
- `createVSCodeChatRenderer`
- `BaseLanguageModelChatProvider`
- `ApiKeyManager`
- settings helpers
- usage-tracking helpers
- MCP integration helpers

## Available APIs

- Chat rendering: `createVSCodeChatRenderer`
- Agent integration: `createVSCodeAgentLoop`
- Provider base class: `BaseLanguageModelChatProvider`
- Key and settings management: `ApiKeyManager` and related helpers
- Usage tracking and MCP-oriented integration utilities

## New APIs (v1.x)

### MCP Chat Bridge

#### `MCPChatBridge`, `createMCPChatBridge`

Bridge MCPTransport to VS Code ChatResponseStream. Use for streaming MCP output into VS Code chat UI.

**Signature:**

```ts
import { MCPChatBridge, createMCPChatBridge } from '@agentsy/vscode/stream-bridge';
const bridge = createMCPChatBridge(transport, cancellationToken);
const stream = bridge.createStream();
```

### VSCode MCP Bridge Helper

#### `VSCodeMCPBridgeHelper`, `createVSCodeMCPBridge`

Wrap MCPTransport and VS Code CancellationToken, expose `createChatResponseStream()` for VS Code chat integration.

**Signature:**

```ts
import { VSCodeMCPBridgeHelper, createVSCodeMCPBridge } from '@agentsy/vscode/mcp';
const helper = createVSCodeMCPBridge(transport, cancellationToken);
const stream = helper.createChatResponseStream();
```

### VS Code Chat Response Stream Overloads

#### `createVSCodeChatResponseStream`, `VSCodeChatResponseStream`

Extended interface and helpers for VS Code ChatResponseStream. Adds typed overloads and utility methods.

**Signature:**

```ts
import { createVSCodeChatResponseStream } from '@agentsy/vscode/vscode-overloads';
const stream = createVSCodeChatResponseStream(rawStream);
```

### Retry Utility

#### `RetryUtility`, `createRetryUtility`

Configurable retry loop with VS Code CancellationToken support. Use for robust, cancellable retry logic.

**Signature:**

```ts
import { RetryUtility, createRetryUtility } from '@agentsy/vscode/retry';
const retry = createRetryUtility(3, 1000, cancellationToken);
const result = await retry.executeWithRetry(async () => doSomething());
```

## Use it when

- you are building a VS Code extension with chat-provider functionality
- you want editor-specific integration without manually wiring the lower-level packages yourself

## Common neighbors

- Lower layers: `@agentsy/processor`, `@agentsy/agent`, `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/normalizers`

## Example

```ts
import { createVSCodeChatRenderer } from '@agentsy/vscode';

const renderer = createVSCodeChatRenderer({ stream: responseStream });
```

## Implementation example with neighbors

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
import { LLMStreamProcessor } from '@agentsy/processor';
import { createVSCodeChatRenderer } from '@agentsy/vscode';

const processor = new LLMStreamProcessor({ parseThinkTags: true });
const renderer = createVSCodeChatRenderer({ stream: responseStream, showThinking: true });

processor.on('text', text => void renderer.markdown(text));

for await (const rawChunk of providerStream) {
  processor.process(normalizeOpenAIChatChunk(rawChunk));
}
```

## Read next

-- [Getting started](../getting-started.md)

## New APIs (v1.x)

### MCP Chat Bridge

#### `MCPChatBridge`, `createMCPChatBridge`

Bridge MCPTransport to VS Code ChatResponseStream. Use for streaming MCP output into VS Code chat UI.

**Signature:**

```ts
import { MCPChatBridge, createMCPChatBridge } from '@agentsy/vscode/stream-bridge';
const bridge = createMCPChatBridge(transport, cancellationToken);
const stream = bridge.createStream();
```

### VSCode MCP Bridge Helper

#### `VSCodeMCPBridgeHelper`, `createVSCodeMCPBridge`

Wrap MCPTransport and VS Code CancellationToken, expose `createChatResponseStream()` for VS Code chat integration.

**Signature:**

```ts
import { VSCodeMCPBridgeHelper, createVSCodeMCPBridge } from '@agentsy/vscode/mcp';
const helper = createVSCodeMCPBridge(transport, cancellationToken);
const stream = helper.createChatResponseStream();
```

### VS Code Chat Response Stream Overloads

#### `createVSCodeChatResponseStream`, `VSCodeChatResponseStream`

Extended interface and helpers for VS Code ChatResponseStream. Adds typed overloads and utility methods.

**Signature:**

```ts
import { createVSCodeChatResponseStream } from '@agentsy/vscode/vscode-overloads';
const stream = createVSCodeChatResponseStream(rawStream);
```

### Retry Utility

#### `RetryUtility`, `createRetryUtility`

Configurable retry loop with VS Code CancellationToken support. Use for robust, cancellable retry logic.

**Signature:**

```ts
import { RetryUtility, createRetryUtility } from '@agentsy/vscode/retry';
const retry = createRetryUtility(3, 1000, cancellationToken);
const result = await retry.executeWithRetry(async () => doSomething());
```

---

See also: Production-style example (coming soon) for full integration.
