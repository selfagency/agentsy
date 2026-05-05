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

- [Getting started](../getting-started.md)
- [API index](../api.md)
- [Package README](https://github.com/selfagency/agentsy/blob/main/packages/vscode/README.md)
