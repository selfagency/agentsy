# Architecture overview

Agentsy is a layered package ecosystem for LLM-heavy TypeScript applications.

## Mental model

The easiest way to understand the system is to follow the flow of a model response:

1. **Provider payload arrives** in provider-specific wire format.
2. **Normalization** converts it into a common incremental vocabulary.
3. **Processing** turns that stream into stable events and applies transforms.
4. **Specialized helpers** extract tool calls, structured JSON, thinking tags, and safe display text.
5. **Projection layers** turn the same event stream into UI state, renderers, or editor integrations.
6. **Agent loops** sit above the pipeline when you want multi-step behavior.

## Current implemented layers

### Provider normalization

- `@agentsy/providers/normalizers`

### Stream processing and transforms

- `@agentsy/core/processor`
- `@agentsy/core/sse`

### Focused parsing utilities

- `@agentsy/core/thinking`
- `@agentsy/core/tool-calls`
- `@agentsy/core/structured`
- `@agentsy/core/context`
- `@agentsy/core/xml-filter`
- `@agentsy/core/formatting`
- `@agentsy/core/recovery`
- `@agentsy/types`

### Projection and state layers

- `@agentsy/renderers`
- `@agentsy/ui`
- `@agentsy/runtime/ag-ui`
- `@agentsy/providers/adapters`
- `@agentsy/providers/pipeline`

### Runtime and integration layer

- `@agentsy/runtime`
- `@agentsy/orchestrator/agent`
- `@agentsy/vscode`

## Guiding dependency rule

Editor- or product-specific integration code belongs at the outer layers, not in the parsing foundation. That keeps the lower layers reusable and easier to test.

## Planned expansion

The `plan/` directory points toward a broader platform that may eventually include runtime, session, memory, retrieval, MCP, provider-management, and connector layers. Those are documented as roadmap concepts until the packages actually exist.

## Decisions

- [ADR 0001: Framework ownership for setup/doctor flows, orchestration helpers, and integration documentation](./decisions/0001-framework-ownership-for-operations-and-integration.md)

## Read next

- [Package ecosystem](./package-ecosystem.md)
- [Stream processing flow](./stream-processing.md)
- [Platform evolution](./platform-evolution.md)
