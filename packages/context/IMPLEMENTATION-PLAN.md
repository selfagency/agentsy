# @agentsy/context — Drift-Aware Compression Plan

> Scope: context compression, drift detection, anchor preservation, output shaping, and observability.
> 
> Out of scope: token budgets, spend accounting, cost tracking, usage analytics, and model routing — those belong in `@agentsy/tokenomics`.

## Goal

Evolve `@agentsy/context` from basic token dropping into a pluggable compression layer that preserves decision points, detects drift, and exposes quality metrics for agentic workflows.

## Requirements

- Preserve critical instructions and decision points during compression.
- Detect drift/coherence loss across repeated compression cycles.
- Support multiple compression strategies behind one API.
- Measure compression quality, not just token reduction.
- Keep public APIs backward compatible where possible.
- Keep token-budget management out of this package.
- Prefer layered compaction: prune/hide first, summarize second, model-assisted summary last.
- Keep compaction summaries structured, inspectable, and task-oriented.
- Support post-compaction hydration metadata for recently edited / high-signal context.
- Allow manual compaction with focus hints at task boundaries (execution handled by runtime/memory).
- Keep durable policy and convention files outside compaction summaries.
- Route compression by content type and role before applying strategies.
- Keep compression stages immutable and composable.
- Preserve reversibility for pruned or compressed content when practical.
- Add hook-based precompression for tool output / command output filters.
- Benchmark by content class, not only aggregate token reduction.

## Package Responsibilities

### In scope

- `compressConversation()`
- `compressOutput()`
- compression strategy registry
- anchored/decision-point preservation
- drift scoring and drift monitoring
- compression metrics / observability
- Cache-friendly output shaping at the context boundary (provider-neutral)

### Out of scope

- `TokenBudget`, `TokenManager`, `TokenUsage`
- request/allocation/release flows
- cost analysis / spend reporting
- route/model budget tracking
- analytics adapters
- learning loop / tokenomics reporting

## Target File Structure

## New files

- `src/strategies/compression-strategy.ts` — strategy interface + registry
- `src/strategies/naive-dropping.ts` — existing baseline strategy
- `src/strategies/anchored-iterative.ts` — anchored compression
- `src/strategies/layered-pruning.ts` — non-destructive message hiding / tombstoning
- `src/strategies/hierarchical-summarization.ts` — layered summary strategy
- `src/strategies/three-layer-offloading.ts` — result/input/message offloading
- `src/strategies/content-router.ts` — content-type / role-based stage selection
- `src/drift/drift-scorer.ts` — coherence and contradiction scoring
- `src/drift/anchor-finder.ts` — decision-point detection
- `src/drift/drift-monitor.ts` — session-level drift tracking
- `src/observability/compression-metrics.ts` — efficacy tracking
- `src/observability/hydration-policy.ts` — post-compaction re-read / refresh metadata
- `src/retrieval/rewind-store.ts` — reversible retrieval markers for pruned content
- `src/hooks/precompression.ts` — tool-output precompression hooks
- `src/providers/cache-prompt.ts` — provider-neutral cache metadata helpers
- `packages/providers/src/caching/anthropic.ts` — Anthropic prompt caching adapter
- `packages/providers/src/caching/openai.ts` — OpenAI prompt caching adapter
- `packages/providers/src/caching/zai.ts` — Z.ai prompt caching adapter
- `src/compression/output-compressor-v2.ts` — enhanced output compression

## Modified files

- `src/index.ts` — export new APIs and maintain backward compatibility
- `src/compression/index.ts` — export compression-related types
- `README.md` — document strategies, drift, metrics, and usage
- `package.json` — keep dependencies minimal

## Tests

- `src/strategies/*.test.ts`
- `src/drift/*.test.ts`
- `src/observability/*.test.ts`
- `src/providers/*.test.ts`

## Implementation Phases

### Phase 1 — Drift foundation

- [x] Define `scoreCoherence()`
- [x] Define `findAnchors()`
- [x] Add `DriftMonitor`
- [x] Extend compression result metadata with drift/quality fields
- [x] Add tests for coherent, contradictory, and repetitive message flows

### Phase 2 — Compression strategies

- [x] Add strategy interface and registry
- [x] Add layered pruning / tombstoning before summarization
- [x] Implement anchored iterative compression
- [x] Keep naive dropping as backward-compatible default
- [x] Add layered pruning as a recoverable hidden-message strategy
- [x] Add hierarchical summarization scaffold
- [x] Add structured handoff summary schema
- [x] Add manual compaction entrypoint with focus hints
- [x] Add content-aware routing for code / JSON / logs / diffs / prose
- [x] Add tests for strategy selection and anchor preservation

### Phase 3 — Output compression + observability

- [x] Implement output-compression v2
- [x] Add compression metrics collector
- [x] Add strategy comparison reporting
- [x] Add hydration metadata for recently edited / high-signal content
- [x] Add reversible retrieval markers for pruned content
- [x] Add benchmarks for compression overhead and quality retention
- [x] Add per-content-class benchmarks and regression fixtures

### Phase 4 — Provider integration

- [x] Add Anthropic prompt caching integration
- [ ] Preserve prefix stability where possible to improve cache reuse
- [x] Add hook-based precompression for tool execution output
- [x] Preserve clean separation from token budgeting / spend tracking
- [x] Emit compaction metadata for runtime/memory to hydrate against
- [x] Update README and examples to match shipped behavior
- [x] Pass package-level typecheck, lint, build, and test gates

#### Cache plan contract

- Runtime owns provider-neutral cache/reuse intent.
- Context exposes stable prefixes and `createCachePromptPlan()`.
- `@agentsy/providers` adapts that plan to Anthropic / OpenAI / Z.ai payloads.

## Acceptance Criteria

- `compressConversation()` remains stable for existing callers.
- Drift-aware metadata is available on compression results.
- Anchors/decision points survive compression when expected.
- Metrics can compare strategy quality and efficiency.
- Compaction can be triggered manually with a focus hint at task boundaries.
- Recently edited files can be rehydrated after compaction.
- Content-aware routing picks the right compressor for code, JSON, logs, diffs, and prose.
- Reversible markers can recover pruned content when needed.
- Cache-friendly output remains prefix-stable for provider adapters.
- No token-budget or spend-tracking APIs live in this package.

## Handoff to Tokenomics

Anything related to budgets, usage, cost, allocations, rate limits, and reporting belongs in `@agentsy/tokenomics`.
