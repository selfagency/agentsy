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

| Package                | Role                                                                | Status    | Docs                                      |
| ---------------------- | ------------------------------------------------------------------- | --------- | ----------------------------------------- |
| `@agentsy/processor`   | Event-driven stream orchestrator and transform pipeline             | Published | [Package page](./packages/processor.md)   |
| `@agentsy/normalizers` | Provider-specific response normalization into a common stream shape | Published | [Package page](./packages/normalizers.md) |
| `@agentsy/agent`       | Multi-step agent loop and stop-condition helpers                    | Published | [Package page](./packages/agent.md)       |
| `@agentsy/adapters`    | Integration-oriented wrappers around the stream-processing pipeline | Published | [Package page](./packages/adapters.md)    |
| `@agentsy/renderers`   | Plain-text rendering plus shared renderer primitives                | Published | [Package page](./packages/renderers.md)   |

## Core parsing and shaping utilities

| Package               | Role                                                       | Status    | Docs                                     |
| --------------------- | ---------------------------------------------------------- | --------- | ---------------------------------------- |
| `@agentsy/thinking`   | Incremental `<think>` content extraction                   | Published | [Package page](./packages/thinking.md)   |
| `@agentsy/tool-calls` | XML and native tool-call helpers                           | Published | [Package page](./packages/tool-calls.md) |
| `@agentsy/structured` | JSON parsing, repair, validation, and streaming helpers    | Published | [Package page](./packages/structured.md) |
| `@agentsy/context`    | Context extraction, dedupe, and normalization helpers      | Published | [Package page](./packages/context.md)    |
| `@agentsy/formatting` | Display-focused text sanitization and formatting utilities | Published | [Package page](./packages/formatting.md) |
| `@agentsy/recovery`   | Recovery snapshots and continuation prompt helpers         | Published | [Package page](./packages/recovery.md)   |
| `@agentsy/xml-filter` | XML tag filtering and privacy-oriented scrubbing utilities | Published | [Package page](./packages/xml-filter.md) |
| `@agentsy/sse`        | Server-sent-event parsing utilities                        | Published | [Package page](./packages/sse.md)        |
| `@agentsy/types`      | Shared type contracts across the ecosystem                 | Published | [Package page](./packages/types.md)      |

## State and protocol packages

| Package          | Role                                                   | Status    | Docs                                |
| ---------------- | ------------------------------------------------------ | --------- | ----------------------------------- |
| `@agentsy/ui`    | Conversation-state store and processor binding helpers | Published | [Package page](./packages/ui.md)    |
| `@agentsy/ag-ui` | AG-UI protocol bridge utilities                        | Published | [Package page](./packages/ag-ui.md) |

## Private package

| Package                | Role                                   | Status  | Docs                                      |
| ---------------------- | -------------------------------------- | ------- | ----------------------------------------- |
| `@agentsy/integration` | Cross-package integration test harness | Private | [Package page](./packages/integration.md) |

## How to use this catalog

- Use the package pages for human-oriented guidance: role, neighbors, examples, and adoption advice.
- Use the [API index](./api.md) for a cross-package export map.
- Use package-local `README.md` files when you need package-specific installation or contributor notes close to the source.

## Planned packages

Planned packages such as runtime/session/memory/provider-management layers are documented in [Platform evolution](./architecture/platform-evolution.md) and [Roadmap](./roadmap.md). They are not listed in the tables above unless real package code exists in `packages/`.
