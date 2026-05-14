# @agentsy/providers — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/providers` is the provider strategy and capability layer for model routing, fallback chains, and provider feature metadata.

Following the latest topology, provider adapters/normalizers also exist in `@agentsy/core/*` subpaths for stream-pipeline compatibility; `@agentsy/providers` remains authoritative for capability matrix, routing policy, and fallback strategy.

### Ecosystem Sketch (Post-Consolidation)

```text
[ @agentsy/runtime ]    [ @agentsy/orchestrator ]
         |                   |
         v                   v
   [ @agentsy/core/universal-client ]
             |
    +--------+--------+
    |        |        |
    v        v        v
[ /adapters ] [ /normalizers ] [ /processor ]
```

## Migration Guidance

Use `@agentsy/providers` for provider selection, capabilities, and fallback routing.

Use `@agentsy/core/*` subpaths for low-level stream adaptation and normalization:

1. **`@agentsy/core/adapters`**: request shaping and wire format transformation.
2. **`@agentsy/core/normalizers`**: standardizing LLM response streams.
3. **`@agentsy/core/universal-client`**: provider-agnostic completion interface.

### Caching and Request Shaping

Prompt caching belongs at the provider boundary. Keep the provider strategy layer responsible for deciding when a request is stable enough to cache and which cache provider to use.

- Prefer CacheLLM-style middleware for stable system prompts, tool schemas, and long conversation prefixes.
- Defer to provider-native cache features when they are a better fit, but keep the policy selection centralized here.
- Never let caching leak into stream normalization or runtime orchestration; those layers should only see normal provider requests and responses.

Recommended cacheable segments:

1. system prompt and policy preamble
2. stable tool definitions and schemas
3. repeated conversation prefixes
4. provider metadata and static routing hints

## Detailed Functionality (Moved to Core)

The following capabilities have been successfully migrated to `@agentsy/core`:

- **Provider Capability Matrix**: Standardized detection of vision, tools, and streaming support.
- **Universal Fetch Wrapper**: Automatic routing and authentication for supported providers.
- **Provider Registry**: A centralized place to add or configure new LLM backends.

## Key Interfaces (Moved to Types)

- `CompletionRequest`
- `CompletionResponse`
- `NormalizedChunk`
- `ProviderCapabilities`

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Provider strategy contracts

```typescript
interface ProviderCapabilities {
  contextWindow: number;
  supportsVision: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsThinking?: boolean;
  supportsCaching?: boolean;
}

interface ProviderStrategy {
  getClient(requirements?: Partial<ProviderCapabilities>): ModelClient;
  withFallback(options: FallbackChainOptions): ModelClient;
  getCapabilities(modelId: string): ProviderCapabilities | undefined;
}
```

### Ownership notes

- Capability matrix and fallback-chain policy belong in `@agentsy/providers`.
- Stream wire adaptation and delta normalization remain exposed from `@agentsy/core` integration subpaths.
- Keep provider dependency graph acyclic and avoid importing orchestration/runtime concerns into provider strategy code.
- Prompt caching strategy selection belongs here as well, so provider-specific cache controls remain consistent across adapters.

---

## Architecture Decision Snapshot (migrated from `plan/DECISION-LOG.md`)

- Provider-layer consolidation direction remains locked: provider-specific normalization/adapters stay under provider boundaries.
- Tooling and provider concerns must not be conflated in interfaces.
- Migration policy remains direct rename/consolidation with import rewrites, not wrapper alias packages.

---

## Provider Capability Matrix (migrated from `plan/provider-capability-matrix.md`)

| Provider     | Base Protocol            | Tool Call Delta                  | Reasoning/Thinking Field | Strict Schema | Notes                                   |
| ------------ | ------------------------ | -------------------------------- | ------------------------ | ------------- | --------------------------------------- |
| DeepSeek     | OpenAI-compatible        | `tool_calls` + `delta`           | `reasoning_content`      | Yes           | Capture reasoning deltas explicitly     |
| Kimi         | OpenAI-compatible        | `tool_calls` + `delta` + `index` | N/A                      | Yes           | Preserve delta index ordering           |
| Qwen         | OpenAI/Ollama-compatible | `tool_calls` + `delta`           | Inline tags in `content` | Partial       | Parse `<tool_call>` from content safely |
| Llama (Meta) | OpenAI/Ollama-compatible | `tool_calls` + `delta`           | N/A                      | No            | Standard OpenAI-compatible behavior     |
| Granite      | OpenAI-compatible        | `tool_calls` + `delta`           | N/A                      | No            | IBM Granite compatibility path          |

### Internal contract mapping

- `StreamChunk.thinking` must capture DeepSeek `reasoning_content`.
- `nativeToolCallDeltas` must preserve indexed deltas (`index`) for Kimi/OpenAI-style streaming.
- Outbound adapter role support remains: `system`, `user`, `assistant`, `tool`.
- Universal outbound part model remains: text, image, tool-call, tool-result.

## Sources Synthesized

`agentsy-connectors-v1.md`, `provider-capability-matrix.md`, `agentsy-tech.md`, `DECISION-LOG.md`, `research/AI-PLATFORMS-ANALYSIS.md`, `research/LLM-INTEGRATION-ANALYSIS.md`, `packages/providers/IMPLEMENTATION-PLAN.md`.
