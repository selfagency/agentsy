# Package catalog

This catalog explains where each current package fits in the Agentsy ecosystem.

For the high-level architecture behind these packages, start with the [Architecture overview](./architecture/index.md).

## Status legend

| Status        | Meaning                                                |
| ------------- | ------------------------------------------------------ |
| **Published** | Stable package currently published to npm              |
| **Private**   | Internal repo package used for verification or tooling |

## Integration packages

| Package           | Role                                                                      | Status    | Docs                                 |
| ----------------- | ------------------------------------------------------------------------- | --------- | ------------------------------------ |
| `@agentsy/vscode` | VS Code chat-provider, rendering, settings, and MCP integration utilities | Published | [Package page](./packages/vscode.md) |

## Runtime and orchestration packages

| Package                          | Role                                                                | Status    | Docs                                      |
| -------------------------------- | ------------------------------------------------------------------- | --------- | ----------------------------------------- |
| `@agentsy/core/processor`        | Event-driven stream processor and provider-agnostic transforms      | Published | [Package page](./packages/processor.md)   |
| `@agentsy/providers`             | Provider package root for adapters, normalizers, and SSE pipelines  | Published | [Package page](./packages/providers.md)   |
| `@agentsy/providers/normalizers` | Provider-specific response normalization into a common stream shape | Published | [Package page](./packages/normalizers.md) |
| `@agentsy/providers/pipeline`    | Provider-coupled SSE pipeline composition                           | Published | [Package page](./packages/providers.md)   |
| `@agentsy/runtime`               | Runtime loops, workflow checkpoints, and spawned task execution     | Published | [Package page](./packages/runtime.md)     |
| `@agentsy/runtime/ag-ui`         | AG-UI protocol adapters and event projection helpers                | Published | [Package page](./packages/ag-ui.md)       |
| `@agentsy/orchestrator/agent`    | Multi-step agent loop and stop-condition helpers                    | Published | [Package page](./packages/agent.md)       |
| `@agentsy/tokens`                | Token budgets, pacing, and conversation compression                 | Published | [Package page](./packages/tokens.md)      |
| `@agentsy/providers/adapters`    | Integration-oriented wrappers around the stream-processing pipeline | Published | [Package page](./packages/adapters.md)    |
| `@agentsy/renderers`             | Plain-text rendering plus shared renderer primitives                | Published | [Package page](./packages/renderers.md)   |

## Routing and provider operations packages

| Package                 | Role                                                     | Status    | Docs                                         |
| ----------------------- | -------------------------------------------------------- | --------- | -------------------------------------------- |
| `@agentsy/load-balancer` | Provider pooling, health tracking, and failover routing  | Internal  | [Package page](./packages/load-balancer.md)  |

## Core parsing and shaping utilities

| Package                    | Role                                                       | Status    | Docs                                     |
| -------------------------- | ---------------------------------------------------------- | --------- | ---------------------------------------- |
| `@agentsy/core/thinking`   | Incremental `<think>` content extraction                   | Published | [Package page](./packages/thinking.md)   |
| `@agentsy/core/tool-calls` | XML and native tool-call helpers                           | Published | [Package page](./packages/tool-calls.md) |
| `@agentsy/core/structured` | JSON parsing, repair, validation, and streaming helpers    | Published | [Package page](./packages/structured.md) |
| `@agentsy/core/context`    | Context extraction, dedupe, and normalization helpers      | Published | [Package page](./packages/context.md)    |
| `@agentsy/core/formatting` | Display-focused text sanitization and formatting utilities | Published | [Package page](./packages/formatting.md) |
| `@agentsy/core/recovery`   | Recovery snapshots and continuation prompt helpers         | Published | [Package page](./packages/recovery.md)   |
| `@agentsy/core/xml-filter` | XML tag filtering and privacy-oriented scrubbing utilities | Published | [Package page](./packages/xml-filter.md) |
| `@agentsy/core/sse`        | Server-sent-event parsing utilities                        | Published | [Package page](./packages/sse.md)        |
| `@agentsy/types`           | Shared type contracts across the ecosystem                 | Published | [Package page](./packages/types.md)      |

## State and protocol packages

| Package       | Role                                                   | Status    | Docs                             |
| ------------- | ------------------------------------------------------ | --------- | -------------------------------- |
| `@agentsy/ui` | Conversation-state store and processor binding helpers | Published | [Package page](./packages/ui.md) |

## Private packages

| Package            | Role                                                    | Status  | Docs                                  |
| ------------------ | ------------------------------------------------------- | ------- | ------------------------------------- |
| `@agentsy/testing` | Cross-package integration tests and shared test harness | Private | [Package page](./packages/testing.md) |
| `@agentsy/scripts` | Build scripts and monorepo automation utilities         | Private | [Package page](./packages/scripts.md) |

## Extensibility packages

| Package            | Role                                                     | Status    | Docs                                  |
| ------------------ | -------------------------------------------------------- | --------- | ------------------------------------- |
| `@agentsy/plugins` | Extensibility framework and protocol adapters            | Published | [Package page](./packages/plugins.md) |
| `@agentsy/tools`   | Tool execution framework and common tool implementations | Published | [Package page](./packages/tools.md)   |

## Integration surfaces

| Package           | Role                                           | Status    | Docs                                 |
| ----------------- | ---------------------------------------------- | --------- | ------------------------------------ |
| `@agentsy/cli`    | Command-line interface for local development   | Published | [Package page](./packages/cli.md)    |
| `@agentsy/vscode` | VS Code Language Model Chat Provider utilities | Published | [Package page](./packages/vscode.md) |

## State and persistence packages

| Package            | Role                                                   | Status    | Docs                                  |
| ------------------ | ------------------------------------------------------ | --------- | ------------------------------------- |
| `@agentsy/ui`      | Conversation-state store and processor binding helpers | Published | [Package page](./packages/ui.md)      |
| `@agentsy/types`   | Shared type contracts across the ecosystem             | Published | [Package page](./packages/types.md)   |
| `@agentsy/memory`  | Long-term memory and persistent state management       | Published | [Package page](./packages/memory.md)  |
| `@agentsy/session` | Session management and conversation lifecycle          | Published | [Package page](./packages/session.md) |
| `@agentsy/secrets` | Secret management and credential handling              | Published | [Package page](./packages/secrets.md) |

## Observability and lifecycle packages

| Package                  | Role                                                | Status    | Docs                                        |
| ------------------------ | --------------------------------------------------- | --------- | ------------------------------------------- |
| `@agentsy/observability` | Telemetry, logging, and monitoring infrastructure   | Published | [Package page](./packages/observability.md) |
| `@agentsy/prompts`       | Prompt templates and prompt orchestration utilities | Published | [Package page](./packages/prompts.md)       |

## Plan-only domains

| Package path          | Role                                                  | Status    | Docs                                                       |
| --------------------- | ----------------------------------------------------- | --------- | ---------------------------------------------------------- |
| `packages/connectors` | External system connectors and integration blueprints | Plan only | [Platform evolution](./architecture/platform-evolution.md) |
| `packages/guardrails` | Safety guardrails and policy enforcement frameworks   | Plan only | [Platform evolution](./architecture/platform-evolution.md) |
| `packages/mcp`        | Model Context Protocol server implementations         | Plan only | [Platform evolution](./architecture/platform-evolution.md) |
| `packages/retrieval`  | Retrieval systems and RAG integration frameworks      | Plan only | [Platform evolution](./architecture/platform-evolution.md) |

---

> **Note:** Plan-only domains are architectural work-in-progress. They have implementation plans but are not yet manifest-backed packages. See [Platform evolution](./architecture/platform-evolution.md) and [Roadmap](./roadmap.md) for details.

## How to use this catalog

- Use the package pages for human-oriented guidance: role, neighbors, examples, and adoption advice.
- Use the [API index](./api.md) for a cross-package export map.
- Use package-local `README.md` files when you need package-specific installation or contributor notes close to the source.

## Planned packages

Planned packages beyond the current runtime/session/memory/tokens stack are documented in [Platform evolution](./architecture/platform-evolution.md) and [Roadmap](./roadmap.md). They are not listed in the tables above unless real package code exists in `packages/`.
