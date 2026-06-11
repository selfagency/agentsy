## Durability and long-horizon state

| Package | Role | Status | Docs |
| --- | --- | --- | --- |
| `@agentsy/context` | Context shaping primitives: compression, drift/coherence, compaction, rewind, and hydration helpers | Published | [Package page](./packages/agentsy-context.md) |
| `@agentsy/memory` | Memory engine, wiki/RAG, MCP server, lifecycle hooks, and sync | Published | [Package page](./packages/memory.md) |
| `@agentsy/session` | Session persistence, serialization, and branching | Published | [Package page](./packages/session.md) |
| `@agentsy/retrieval` | Retrieval-oriented composition boundary | Internal | Platform docs |

## Provider and protocol integration

| Package | Role | Status | Docs |
| --- | --- | --- | --- |
| `@agentsy/providers` | Provider adapters, normalizers, and pipelines | Published | [Package page](./packages/providers.md) |
| `@agentsy/mcp` | Model Context Protocol integration boundary | Internal | Platform docs |
| `@agentsy/gateway` | Model-tier routing, replica selection, failover, and health tracking | Internal | [Package page](./packages/gateway.md) |

> Routing authority now lives in `@agentsy/gateway`; model-replica routing details are documented in [Routing architecture](./architecture/routing-architecture.md).
