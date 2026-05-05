# Agentsy

Composable infrastructure for LLM systems.

Build headless agentic workflows in Node.js-compatible runtimes, plug in only the layers you need, and stay aligned with open standards like MCP and AG-UI instead of a captive vendor stack.

[![Tests](https://github.com/selfagency/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/agentsy/actions/workflows/tests.yml) [![codecov](https://codecov.io/gh/selfagency/agentsy/graph/badge.svg?token=4U6b4yU5Ln)](https://codecov.io/gh/selfagency/agentsy) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/be00077d20c54f9097c7f38bf575603f)](https://app.codacy.com/gh/selfagency/agentsy/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=selfagency_llm-stream-parser&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=selfagency_llm-stream-parser) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## Why choose Agentsy

- **Streaming-first by default**: handle chunk boundaries, partial outputs, tool-call deltas, and finish states as first-class concerns.
- **Headless-first architecture**: ship robust automation, CLI tooling, and agent workflows before committing to a UI surface.
- **Composable package ecosystem**: adopt one package or a full pipeline — no all-or-nothing framework tax.
- **Type-safe and defensive**: strict TypeScript contracts and recoverable parsing behavior for untrusted model output.
- **Open ecosystem alignment**: practical interoperability with standards and protocols such as MCP and AG-UI.

## Already used in production

Agentsy already powers third-party model support in VS Code extensions for GitHub Copilot Chat:

- [Opilot](https://marketplace.visualstudio.com/items?itemName=selfagency.opilot) — Ollama models with local workflows, tool calling, vision, and streaming
- [Z.ai for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.z-models-vscode) — Z.ai coding models with streaming, tool calling, and MCP-assisted capabilities
- [Mistral for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.mistral-models-vscode) — Mistral AI models with streaming, tool calling, and vision support

## Example workflows

- [CLI log summarizer (easy)](./docs/examples/cli-log-summarizer.md) — stream model output into terminal-ready summaries with minimal wiring.
- [DNS blocklist workflow](./docs/examples/dns-blocklist.md) — ingest multiple logs, stream model output, validate schema, and update remote DNS when a source IP should be blocked.
- [Multi-provider policy gate](./docs/examples/multi-provider-policy-gate.md) — switch providers while keeping one schema-gated automation contract.
- [Agent tool loop with retries + continuation](./docs/examples/tool-loop-retries-continuation.md) — run a multi-step tool loop, retry transient failures, and resume interrupted streams.
- [Stateful ops copilot backend](./docs/examples/stateful-ops-copilot.md) — project stream events into state and AG-UI clients with continuation recovery.
- [All-tooling end-to-end workflow](./docs/examples/all-tooling-end-to-end.md) — combine stream ingestion, normalization, processing, tool loops, recovery, state projection, AG-UI conversion, rendering, and action gating in one flow.

## Package ecosystem

This repository is a **pnpm workspace monorepo** orchestrated with **Turborepo** and organized as focused `@agentsy/*` packages.

### Integration

| Package                                        | Role                                                                      | Status    |
| ---------------------------------------------- | ------------------------------------------------------------------------- | --------- |
| [`@agentsy/vscode`](./docs/packages/vscode.md) | VS Code chat-provider, rendering, settings, and MCP integration utilities | Published |

### Runtime and orchestration

| Package                                                  | Role                                                             | Status    |
| -------------------------------------------------------- | ---------------------------------------------------------------- | --------- |
| [`@agentsy/processor`](./docs/packages/processor.md)     | Event-driven stream orchestrator and transform pipeline          | Published |
| [`@agentsy/normalizers`](./docs/packages/normalizers.md) | Provider-specific normalization into a common stream shape       | Published |
| [`@agentsy/agent`](./docs/packages/agent.md)             | Multi-step agent loop and stop-condition helpers                 | Published |
| [`@agentsy/adapters`](./docs/packages/adapters.md)       | Integration-oriented wrappers around stream-processing pipelines | Published |
| [`@agentsy/renderers`](./docs/packages/renderers.md)     | Plain-text rendering plus shared renderer primitives             | Published |

### Core parsing and shaping utilities

| Package                                                | Role                                                       | Status    |
| ------------------------------------------------------ | ---------------------------------------------------------- | --------- |
| [`@agentsy/thinking`](./docs/packages/thinking.md)     | Incremental `<think>` content extraction                   | Published |
| [`@agentsy/tool-calls`](./docs/packages/tool-calls.md) | XML and native tool-call helpers                           | Published |
| [`@agentsy/structured`](./docs/packages/structured.md) | JSON parsing, repair, validation, and streaming helpers    | Published |
| [`@agentsy/context`](./docs/packages/context.md)       | Context extraction, dedupe, and normalization helpers      | Published |
| [`@agentsy/formatting`](./docs/packages/formatting.md) | Display-focused text sanitization and formatting utilities | Published |
| [`@agentsy/recovery`](./docs/packages/recovery.md)     | Recovery snapshots and continuation prompt helpers         | Published |
| [`@agentsy/xml-filter`](./docs/packages/xml-filter.md) | XML tag filtering and privacy-oriented scrubbing utilities | Published |
| [`@agentsy/sse`](./docs/packages/sse.md)               | Server-sent-event parsing utilities                        | Published |
| [`@agentsy/types`](./docs/packages/types.md)           | Shared type contracts across the ecosystem                 | Published |

### State and protocol

| Package                                      | Role                                                   | Status    |
| -------------------------------------------- | ------------------------------------------------------ | --------- |
| [`@agentsy/ui`](./docs/packages/ui.md)       | Conversation-state store and processor binding helpers | Published |
| [`@agentsy/ag-ui`](./docs/packages/ag-ui.md) | AG-UI protocol bridge utilities                        | Published |

### Private package

| Package                                                  | Role                                   | Status  |
| -------------------------------------------------------- | -------------------------------------- | ------- |
| [`@agentsy/integration`](./docs/packages/integration.md) | Cross-package integration test harness | Private |

## Pick your adoption path

- **I need robust Node streaming pipelines** → start with [`@agentsy/normalizers`](./docs/packages/normalizers.md) + [`@agentsy/processor`](./docs/packages/processor.md)
- **I need JSON schema gates before automation** → add [`@agentsy/structured`](./docs/packages/structured.md)
- **I need multi-step agent behavior** → add [`@agentsy/agent`](./docs/packages/agent.md)
- **I need VS Code integration utilities** → add [`@agentsy/vscode`](./docs/packages/vscode.md)
- **I need protocol/state helpers** → add [`@agentsy/ag-ui`](./docs/packages/ag-ui.md), [`@agentsy/ui`](./docs/packages/ui.md), and focused utility packages

If you prefer a thinner integration layer, start with `@agentsy/normalizers` + `@agentsy/processor`, then add `@agentsy/structured` once you want strict schema gates before automated actions.

## Documentation map

- [Documentation home](./docs/index.md)
- [Getting started](./docs/getting-started.md)
- [Why Agentsy](./docs/why-agentsy.md)
- [Examples](./docs/examples/index.md)
- [API index](./docs/api.md)
- [Package catalog](./docs/packages.md)
- [Roadmap](./docs/roadmap.md)
- [Developer guide](./docs/developers/index.md)

Deep architecture material lives under [`docs/architecture/`](./docs/architecture/index.md), while contributor and automation specifics remain in the developer docs and repository instructions.

### Monorepo commands

```bash
pnpm install
pnpm build
pnpm check-types
pnpm test
```

## License

[MIT](LICENSE.md)
