# Agentsy

Production-ready LLM stream parsing and VS Code integration for multi-step agent workflows.

[![npm @agentsy/parser](https://img.shields.io/npm/v/@agentsy/parser?label=%40agentsy%2Fparser)](https://www.npmjs.com/package/@agentsy/parser)
[![npm @agentsy/vscode](https://img.shields.io/npm/v/@agentsy/vscode?label=%40agentsy%2Fvscode)](https://www.npmjs.com/package/@agentsy/vscode)
[![CI](https://github.com/agentsy/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/agentsy/agentsy/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## 🎯 Overview

Agentsy is a **Turbo monorepo** with independent, composable packages for processing LLM responses in agent systems. Each package is published separately to npm under the `@agentsy` scope.

### 📦 Packages

- **[@agentsy/core](./packages/core/README.md)** (v1.0.0) — Stream parsing & orchestration (foundation layer). [npm](https://www.npmjs.com/package/@agentsy/core) | [docs](./docs/index.md)
- **[@agentsy/vscode](./packages/vscode/README.md)** (v0.1.0) — VS Code integration utilities. [npm](https://www.npmjs.com/package/@agentsy/vscode)

### 🚀 Coming Soon

- **@agentsy/agents** — Multi-step LLM agents with memory, planning, and reflection
- **@agentsy/tools** — Standardized tool definitions for code execution, web search, and file I/O
- **@agentsy/cli** — Command-line agent runner with live streaming and JSONL output
- **@agentsy/ui** — React components for agent progress, thinking visualization, and tool interaction

## ⚡ Quick Start

### Stream Parsing

Parse LLM responses chunk-by-chunk with `@agentsy/core`:

```bash
npm install @agentsy/core
```

```typescript
import { LLMStreamProcessor } from '@agentsy/core/processor';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit_file']),
});

processor.on('thinking', delta => console.log(`[💭] ${delta}`));
processor.on('text', delta => process.stdout.write(delta));
processor.on('tool_call', call => executeTool(call));

for await (const chunk of llmStream) {
  processor.process({
    content: chunk.content,
    done: chunk.done,
  });
}
```

### VS Code Provider

Build Language Model Chat Providers with `@agentsy/vscode`:

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

  protected async buildRequest(messages, request) {
    return { model: request.model.id, messages };
  }

  protected async callApi(request) {
    // Call your LLM API
    return response;
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(languages.registerLanguageModelChatProvider('my-provider', new MyProvider(context)));
}
```

## 📚 Documentation

- **Getting Started** — [Setup and basic patterns](./docs/getting-started.md)
- **API Reference** — [Complete parser API docs](./docs/api.md)
- **Developer Guide** — [Local development and contribution](./docs/developers/index.md)
- **Integration Examples** — [Anthropic, OpenAI, Gemini patterns](./docs/developers/integration-copilot.md)
- **VS Code Integration** — [Provider setup and hooks](./packages/vscode/README.md)

## 🏗️ Monorepo Structure

```text
agentsy/
├── packages/
│   ├── core/                    # @agentsy/core (v1.0.0 — foundation)
│   │   ├── src/
│   │   │   ├── thinking/        # <think> tag extraction
│   │   │   ├── xml-filter/      # XML context scrubbing
│   │   │   ├── tool-calls/      # Tool call extraction
│   │   │   ├── structured/      # JSON parsing & validation
│   │   │   ├── processor/       # Event-driven orchestrator
│   │   │   ├── adapters/        # Provider normalizers
│   │   │   ├── agent/           # Multi-step agent loops
│   │   │   └── ...more modules
│   │   └── package.json
│   └── vscode/                  # @agentsy/vscode (v0.1.0)
│       ├── src/
│       │   ├── extension/       # Extension hooks
│       │   ├── provider/        # BaseLanguageModelChatProvider
│       │   ├── api-key-manager/ # SecretStorage integration
│       │   ├── error-handling/  # Error mapping
│       │   └── ...more modules
│       └── package.json
├── docs/                        # Unified documentation
│   ├── index.md                 # Overview
│   ├── getting-started.md
│   ├── api.md
│   └── developers/
├── turbo.json                   # Monorepo orchestration
├── pnpm-workspace.yaml          # Workspace config
├── package.json                 # Root config
├── tsconfig.json                # Shared TypeScript config
├── .oxlintrc.json               # Linting config
├── .oxfmtrc.json                # Formatting config
└── pnpm-lock.yaml
```

## 🛠️ Development

### Prerequisites

- Node.js 22+ (verified in CI)
- pnpm 10+ (workspace package manager)

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm turbo run build

# Run tests
pnpm turbo run test

# Lint and format
pnpm turbo run lint
pnpm turbo run format
```

### Turbo Tasks

All build, test, and lint tasks are orchestrated via Turbo with intelligent caching:

```bash
pnpm turbo run build        # Build all packages (cached)
pnpm turbo run test         # Run all tests
pnpm turbo run check-types  # TypeScript strict mode check
pnpm turbo run lint         # Lint all packages (oxlint)
pnpm turbo run format       # Format all packages (oxfmt)
pnpm turbo run precommit    # Pre-commit hook (types + lint + format)
```

### Local Package Development

Both packages use `workspace:*` dependencies, so local changes are reflected immediately:

```typescript
// packages/vscode/package.json
{
  "dependencies": {
    "@agentsy/parser": "workspace:*"  // Always uses local packages/ version
  }
}
```

## 🧪 Testing

Each package has full test coverage with Vitest:

```bash
# Test single package
cd packages/parser && pnpm test

# Test all packages
pnpm turbo run test

# Test with coverage
pnpm turbo run test -- --coverage
```

## 📦 Publishing

Both packages are published independently to npm:

```bash
# Build for distribution
pnpm turbo run build

# Create release tags
git tag @agentsy/parser@1.0.0
git tag @agentsy/vscode@0.1.0

# Push tags to trigger GitHub Actions release workflow
git push --tags
```

See [.github/workflows/release.yml](.github/workflows/release.yml) for CI/CD automation.

## 🔒 Security

- **TypeScript strict mode** — Zero `any` types; exact optional property types enforced
- **Input validation** — All LLM output is validated and bounded (depth limits, key counts, tool call sizes)
- **Privacy by default** — Privacy tags are always scrubbed from output
- **Dependency scanning** — Trivy security scans in CI/CD

## 📄 License

[MIT](LICENSE.md)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./docs/developers/contributing.md) for guidelines.

## 📞 Support

- **GitHub Issues** — [Report bugs and request features](https://github.com/agentsy/agentsy/issues)
- **GitHub Discussions** — [Ask questions and share ideas](https://github.com/agentsy/agentsy/discussions)
- **Email** — [support@agentsy.dev](mailto:support@agentsy.dev)

## 🙏 Acknowledgments

Built with [Turbo](https://turbo.build), [pnpm](https://pnpm.io), [TypeScript](https://www.typescriptlang.org), and [Vitest](https://vitest.dev).
