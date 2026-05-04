# Welcome to Agentsy

Production-ready LLM stream parsing and VS Code integration for multi-step agent workflows.

## 🎯 Overview

Agentsy is a Turbo monorepo providing composable, battle-tested utilities for processing LLM responses in agent systems:

### 📦 Available Packages

#### **@agentsy/core** (v1.0.0)

Foundation stream parsing layer:

- **Thinking extraction** — Chunk-by-chunk `<think>` tag processing
- **XML filtering** — Privacy-aware context scrubbing and deduplication
- **Tool-call extraction** — Validate and normalize tool invocations
- **Structured output** — JSON parsing with depth/key limits and auto-repair
- **Stream processor** — Event-driven multi-parser orchestration
- **Normalizers** — OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, AWS Bedrock adapters
- **Zero dependencies** — Foundation layer has no runtime dependencies beyond Node.js built-ins

#### **@agentsy/vscode** (v0.1.0)

VS Code integration library for Language Model Chat Providers:

- **ApiKeyManager** — Secure secrets management via VS Code SecretStorage
- **BaseLanguageModelChatProvider** — Abstract provider template with processor integration
- **ChatResponseStream renderers** — Thinking progress display, tool execution feedback, cancellation support
- **UsageStatusBar** — Quota tracking UI with configurable thresholds
- **SettingsLoader** — Typed configuration with schema validation
- **Error handling** — Standardized error mapping and recovery

### 🚀 Coming Soon

- **@agentsy/agents** — Multi-step LLM agents with memory, planning, and reflection
- **@agentsy/tools** — Standardized tool definitions for code execution, web search, and file I/O
- **@agentsy/cli** — Command-line agent runner with live streaming and JSONL output
- **@agentsy/ui** — React components for agent progress, thinking visualization, and tool interaction

## ⚡ Quick Start

### Choose Your Path

#### 🧠 Building a Stream Parser

Use `@agentsy/core` for chunk-by-chunk LLM output processing:

```bash
npm install @agentsy/core
```

```typescript
import { LLMStreamProcessor } from '@agentsy/core/processor';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit_file']),
});

processor.on('thinking', delta => console.log(`[think] ${delta}`));
processor.on('text', delta => console.log(delta));
processor.on('tool_call', call => executeTool(call));

for await (const chunk of llmStream) {
  processor.process({
    content: chunk.content,
    done: chunk.done,
  });
}
```

#### 💻 Building a VS Code Provider

Use `@agentsy/vscode` to integrate Language Model Chat Providers:

```bash
npm install @agentsy/vscode @agentsy/core vscode
```

```typescript
import { BaseLanguageModelChatProvider } from '@agentsy/vscode';

export class MyProvider extends BaseLanguageModelChatProvider {
  constructor(context: ExtensionContext) {
    super(context, {
      providerId: 'my-provider',
      vendor: 'MyVendor',
      displayName: 'My Provider',
      maxInputTokens: 4096,
      supportedCapabilities: ['thinking', 'tool-calls'],
    });
  }

  protected buildRequest(messages, request) {
    // Convert to your API format
    return { model: request.model.id, messages };
  }
}
```

## ✨ Key Features

- **Streaming-first** — Chunk-by-chunk processing designed for real-time LLM responses
- **Composable** — Mix and match parsers; orchestrate with the event-driven processor
- **Type-safe** — Full TypeScript with strict mode and zero `any` types
- **Safe by default** — Privacy tags always scrubbed; JSON depth, key counts, tool calls bounded
- **Production-ready** — 1,100+ tests; 90%+ code coverage; zero dependencies in parser
- **VS Code native** — Native SecretStorage, StatusBar, and chat response stream integration

## 💡 Use Cases

- **Multi-step agents** — Process Claude, o1, or other LLM outputs in reasoning loops
- **RAG systems** — Parse structured output with thinking visibility
- **Tool use & automation** — Extract, validate, and execute tool calls safely
- **Real-time streaming** — Process responses chunk-by-chunk without buffering
- **VS Code extensions** — Build Language Model Chat Providers with native integration
- **Production pipelines** — Privacy-aware, bounded parsing for enterprise systems

## 📚 Documentation

### For @agentsy/core

- [Getting Started](/getting-started) — Core layer setup and patterns
- [API Reference](/api/core) — Complete core API docs
- [Integration Examples](/examples/core-parsing) — Anthropic, OpenAI, Gemini patterns

### For @agentsy/vscode

- [VS Code Integration Guide](/developers/integration-vscode) — Provider setup and hooks
- [Chat Rendering](/developers/chat-rendering) — Thinking display and tool feedback

### General

- [Developer Guide](/developers/) — Local setup, testing, contribution workflow
- [Roadmap](./developers/roadmap.md) — Planned packages and features

## 🏗️ Monorepo Structure

```text
agentsy/
├── packages/
│   ├── parser/      # @agentsy/core (stream processing core)
│   └── vscode/      # @agentsy/vscode (VS Code integration)
├── docs/            # Unified documentation
├── turbo.json       # Monorepo orchestration (build, test, lint, format)
└── pnpm-workspace.yaml
```

All packages are published independently to npm under the `@agentsy` scope.

## 🔗 Links

- npm: [@agentsy/core](https://www.npmjs.com/package/@agentsy/core) | [@agentsy/vscode](https://www.npmjs.com/package/@agentsy/vscode)
- GitHub: [agentsy/agentsy](https://github.com/agentsy/agentsy)
- Discussions: [GitHub Discussions](https://github.com/agentsy/agentsy/discussions)

## 📄 License

MIT
