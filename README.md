# Agentsy

Composable infrastructure for LLM systems.

Build headless agentic workflows in Node.js-compatible runtimes, plug in only the layers you need, and stay aligned with open standards like MCP and AG-UI instead of a captive vendor stack.

[![Tests](https://github.com/selfagency/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/agentsy/actions/workflows/tests.yml) [![codecov](https://codecov.io/gh/selfagency/agentsy/graph/badge.svg?token=4U6b4yU5Ln)](https://codecov.io/gh/selfagency/agentsy) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/be00077d20c54f9097c7f38bf575603f)](https://app.codacy.com/gh/selfagency/agentsy/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=selfagency_agentsy&metric=alert_status)](https://monorail.cloud/quality-gate/Self-Agency/agentsy) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## Why choose Agentsy

- **Streaming-first by design**: handle chunk boundaries, partial outputs, tool-call deltas, and finish states as first-class concerns
- **Headless-first architecture**: ship robust automation, CLI tooling, and agent workflows before committing to a UI surface
- **Composable package ecosystem**: adopt one package or a full pipeline — no all-or-nothing framework tax
- **Type-safe and defensive**: strict TypeScript contracts and recoverable parsing behavior for untrusted model output
- **Open ecosystem alignment**: practical interoperability with standards and protocols such as MCP and AG-UI

## Already used in production

Agentsy already powers third-party model support in VS Code extensions for GitHub Copilot Chat:

- [Opilot](https://marketplace.visualstudio.com/items?itemName=selfagency.opilot) — Ollama models with local workflows, tool calling, vision, and streaming
- [Z.ai for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.z-models-vscode) — Z.ai coding models with streaming, tool calling, and MCP-assisted capabilities
- [Mistral for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.mistral-models-vscode) — Mistral AI models with streaming, tool calling, and vision support

## Package ecosystem

This repository is a **pnpm workspace monorepo** organized as focused `@agentsy/*` packages.

### Tier 0: Foundation

| Package                            | Role                                       | Status    |
| ---------------------------------- | ------------------------------------------ | --------- |
| [`@agentsy/types`](packages/types) | Shared type contracts across the ecosystem | Published |

### Tier 1: Provider Connectors

| Package                                        | Role                                               | Status    |
| ---------------------------------------------- | -------------------------------------------------- | --------- |
| [`@agentsy/normalizers`](packages/normalizers) | Provider-specific normalization into common shape  | Published |
| [`@agentsy/connectors`](packages/connectors)   | HTTP, WebSocket, and MCP client connections        | Published |
| [`@agentsy/adapters`](packages/adapters)       | Integration-oriented wrappers around pipelines     | Published |
| [`@agentsy/mcp`](packages/mcp)                 | Model Context Protocol server and client utilities | Published |
| [`@agentsy/providers`](packages/providers)     | LLM provider abstraction and credential management | Published |

### Tier 2: Stream Processing

| Package                                      | Role                                                    | Status    |
| -------------------------------------------- | ------------------------------------------------------- | --------- |
| [`@agentsy/processor`](packages/processor)   | Event-driven stream orchestrator and transform pipeline | Published |
| [`@agentsy/sse`](packages/sse)               | Server-sent-event parsing utilities                     | Published |
| [`@agentsy/structured`](packages/structured) | JSON parsing, repair, validation, and streaming         | Published |
| [`@agentsy/recovery`](packages/recovery)     | Recovery snapshots and continuation helpers             | Published |

### Tier 3: Agent Runtime

| Package                                | Role                                                 | Status    |
| -------------------------------------- | ---------------------------------------------------- | --------- |
| [`@agentsy/runtime`](packages/runtime) | Agent loop execution and lifecycle orchestration     | Published |
| [`@agentsy/tokens`](packages/tokens)   | Token budgets, context reduction, and output shaping | Published |
| [`@agentsy/session`](packages/session) | Session management and continuation recovery         | Published |
| [`@agentsy/memory`](packages/memory)   | Durable knowledge layer and retrieval systems        | Published |

### Tier 4: Protocol & State

| Package                                  | Role                                      | Status    |
| ---------------------------------------- | ----------------------------------------- | --------- |
| [`@agentsy/thinking`](packages/thinking) | Thinking content extraction and reasoning | Published |
| [`@agentsy/ag-ui`](packages/ag-ui)       | AG-UI protocol bridge utilities           | Published |

### Tier 5: Tooling & Security

| Package                                      | Role                                          | Status    |
| -------------------------------------------- | --------------------------------------------- | --------- |
| [`@agentsy/tools`](packages/tools)           | Tool invocation orchestration and retry logic | Published |
| [`@agentsy/guardrails`](packages/guardrails) | Safety validation and content filtering       | Published |
| [`@agentsy/xml-filter`](packages/xml-filter) | XML privacy filtering and scrubbing           | Published |
| [`@agentsy/tool-calls`](packages/tool-calls) | Tool call parsing and normalization           | Published |

### Tier 6: Integration & Testing

| Package                                        | Role                                              | Status    |
| ---------------------------------------------- | ------------------------------------------------- | --------- |
| [`@agentsy/cli`](packages/cli)                 | CLI tooling and development utilities             | Published |
| [`@agentsy/repl`](packages/repl)               | Interactive REPL and debugging workflow           | Published |
| [`@agentsy/testing`](packages/testing)         | Test utilities and integration test harness       | Published |
| [`@agentsy/vscode`](packages/vscode)           | VS Code chat-provider, rendering, and integration | Published |
| [`@agentsy/integration`](packages/integration) | Cross-package integration monitoring              | Private   |

### Orchestration & Observability

| Package                                            | Role                                             | Status    |
| -------------------------------------------------- | ------------------------------------------------ | --------- |
| [`@agentsy/orchestrator`](packages/orchestrator)   | Multi-agent coordination and workflow management | Published |
| [`@agentsy/observability`](packages/observability) | Logging, metrics, and distributed tracing        | Published |
| [`@agentsy/scheduler`](packages/scheduler)         | Task scheduling and execution orchestration      | Published |

### Enterprise Features

| Package                                | Role                                            | Status    |
| -------------------------------------- | ----------------------------------------------- | --------- |
| [`@agentsy/secrets`](packages/secrets) | Secret management and credential vault          | Published |
| [`@agentsy/acp`](packages/acp)         | Access control policy and permission management | Published |

### Agents & Coordination

| Package                                          | Role                                               | Status    |
| ------------------------------------------------ | -------------------------------------------------- | --------- |
| [`@agentsy/agent`](packages/agent)               | Individual agent implementation and helpers        | Published |
| [`@agentsy/agents`](packages/agents)             | Multi-agent coordination and interaction patterns  | Published |
| [`@agentsy/plugins`](packages/plugins)           | Extensible plugin system for provider integrations | Published |
| [`@agentsy/agentic-loop`](packages/agentic-loop) | Multi-agent loop coordination and communication    | Published |

### Context & Retrieval

| Package                                                | Role                                         | Status    |
| ------------------------------------------------------ | -------------------------------------------- | --------- |
| [`@agentsy/context`](packages/context)                 | Context window management and tooling        | Published |
| [`@agentsy/context-manager`](packages/context-manager) | Advanced context management and optimization | Published |
| [`@agentsy/retrieval`](packages/retrieval)             | Information retrieval and RAG coordination   | Published |

### Rendering & Formatting

| Package                                      | Role                                                | Status    |
| -------------------------------------------- | --------------------------------------------------- | --------- |
| [`@agentsy/renderers`](packages/renderers)   | Plain-text rendering and shared renderer primitives | Published |
| [`@agentsy/formatting`](packages/formatting) | Display-focused text sanitization and formatting    | Published |

### Utilities & Advanced

| Package                                            | Role                                              | Status    |
| -------------------------------------------------- | ------------------------------------------------- | --------- |
| [`@agentsy/retry`](packages/retry)                 | Retry logic with exponential backoff and jitter   | Published |
| [`@agentsy/token-economy`](packages/token-economy) | Advanced token budget management and optimization | Published |

## Pick your adoption path

- **I need robust Node streaming pipelines** → start with [`@agentsy/normalizers`](packages/normalizers) + [`@agentsy/processor`](packages/processor)
- **I need JSON schema gates before automation** → add [`@agentsy/structured`](packages/structured)
- **I need multi-step agent behavior** → add [`@agentsy/runtime`](packages/runtime) + [`@agentsy/agent`](packages/agent)
- **I need VS Code integration utilities** → add [`@agentsy/vscode`](packages/vscode)
- **I need memory/persistence** → add [`@agentsy/memory`](packages/memory) + [`@agentsy/session`](packages/session)
- **I need protocol/state helpers** → add [`@agentsy/ag-ui`](packages/ag-ui)
- **I need tool calling** → add [`@agentsy/tools`](packages/tools) + [`@agentsy/tool-calls`](packages/tool-calls)
- **I need enterprise security** → add [`@agentsy/guardrails`](packages/guardrails) + [`@agentsy/secrets`](packages/secrets)

## Monorepo commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check all packages
pnpm check-types

# Run all tests
pnpm test

# Run coverage reports
pnpm test:coverage

# Lint all packages
pnpm lint

# Format all packages
pnpm format
```

## Documentation map

- [Documentation home](./docs/index.md)
- [Getting started](./docs/getting-started.md)
- [Why Agentsy](./docs/why-agentsy.md)
- [API index](./docs/api.md)
- [Package catalog](./docs/packages.md)
- [Roadmap](./docs/roadmap.md)
- [Developer guide](./docs/developers/index.md)

Deep architecture material lives under [`docs/architecture/`](./docs/architecture/index.md), while contributor and automation specifics remain in the developer docs and repository instructions.

## License

[MIT](LICENSE.md)
