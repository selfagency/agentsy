# Cross-Package Replica Routing Architecture

## Package Responsibilities

| Package | Responsibility |
|---|---|
| `@agentsy/gateway` | **Routing authority** — owns logical model registry, replica registry, replica scoring/selection, local-first preference, and provider transport execution |
| `@agentsy/tokenomics` | **Headroom authority** — tracks usage by replica/account, computes rolling hour/week/month headroom, exposes routing signals (quota, saturation, skew) |
| `@agentsy/orchestrator` | **Escalation policy** — infers task tier, delegates model selection to gateway, orchestrates failover (next replica → next same-tier model → tier escalation) |
| `@agentsy/runtime` | **Lifecycle observability** — emits model call lifecycle events, checkpoints routing state for deterministic retries and failover |
| `@agentsy/guardrails` | **Routing constraints** — provides policy constraints (`local-only`, `excludeProviders`, `requireReasoning`, `requireJsonMode`) but does not contain routing logic |
| `@agentsy/types` | **Shared types** — optional carrier for shared routing types if cross-package contracts require them |
| `@agentsy/core` | **No routing responsibility** — stream processing and transforms only |

## Routing Flow

```text
User / Task
    │
    ▼
@agentsy/orchestrator
    • infers TaskTier (micro | small | mid | frontier)
    • infers useCase (chat | code | search | embed | vision)
    • requests model selection from gateway
    • applies failover policy on error
    │
    ▼
@agentsy/gateway — Model Selection
    • resolves tier → candidate logical models (tier-aware selector)
    • applies guardrails constraints
    • selects best logical model
    │
    ▼
@agentsy/gateway — Replica Selection
    • resolves logical model → candidate replicas
    • filters by health, capability constraints, quota headroom
    • scores replicas (local bonus, latency, cost, error rate)
    • selects best replica
    │
    ▼
@agentsy/gateway — Execution
    • overrides request.model with replica's upstreamModelName
    • executes through provider transport
    • records usage to tokenomics
    │
    ▼
Spillover (on failure)
    • next replica for same logical model
    • next logical model in same tier
    • tier escalation (only if orchestrator policy allows)
    │
    ▼
@agentsy/runtime — Lifecycle
    • emits PreModelCall, PostModelCall, ModelCallFailed, ModelReplicaSwitched
    • checkpoints attempted replicas for deterministic retry
```

## Key Types

### `ModelTier`

```typescript
type ModelTier = 'micro' | 'small' | 'mid' | 'frontier';
```

Tiers are defined on **models**, not providers. A single provider (e.g. OpenAI) hosts models across all tiers (`gpt-4o-mini` = small, `gpt-4o` = mid, `o1` = frontier).

### `LogicalModel`

Canonical model identity — the "what" you want to invoke:

```typescript
interface LogicalModel {
  id: string;                       // "claude-sonnet-4", "gpt-4o-mini"
  tier: ModelTier;
  useCases: Array<UseCase>;
  capabilities: ModelCapabilities;
  contextWindow: number;
  maxOutputTokens: number;
}
```

### `ModelEntry`

A specific provider's offering of a logical model (one provider may serve multiple logical models):

```typescript
interface ModelEntry {
  id: string;                       // "openai/gpt-4o-mini"
  providerId: string;               // FK -> ProviderEntry.id
  modelName: string;                // upstream API name
  tier: ModelTier;
  cost: ModelCost;
  capabilities: ModelCapabilities;
  contextWindow: number;
  isLocal?: boolean;
}
```

### `ModelReplica`

Concrete endpoint serving a logical model — the "where" it runs:

```typescript
interface ModelReplica {
  id: string;                       // "anthropic-main/claude-sonnet-4"
  logicalModelId: string;
  providerId: string;
  upstreamModelName: string;
  isLocal: boolean;
  cost: ModelCost;
  health: ReplicaHealthSnapshot;
  quota: ReplicaQuotaSnapshot;
}
```

### `ModelSelectionResult`

The output of a selection — explainable routing decision:

```typescript
interface ModelSelectionResult {
  logicalModelId: string;
  replicaId: string;
  providerId: string;
  selectedBecause: string[];        // Reasons for this selection
  rejectedCandidates: Array<{
    id: string;
    reasons: string[];              // Why each candidate was rejected
  }>;
}
```

## Architecture Principles

### Gateway is the single routing authority

All model-selection and replica-selection logic lives in `@agentsy/gateway`. The orchestrator, runtime, and guardrails never contain their own routing tables or replica selection logic.

- Gateway owns: logical model registry, replica registry, tier-aware selectors, replica scoring, spillover
- Gateway does NOT own: task tiering (orchestrator), usage tracking (tokenomics), lifecycle events (runtime)

### Orchestrator controls escalation policy

The orchestrator defines the failover and escalation order but delegates the actual selection to gateway:

1. Call gateway with `(tier, useCase)` — gateway returns a selected replica
2. On failure: call gateway with `(tier, useCase, {exclude: [failedReplicaId]})`
3. On all replicas exhausted: optionally escalate tier via orchestrator policy

### Tokenomics is the single headroom authority

Gateway may derive ephemeral quota from provider response headers, but tokenomics is authoritative for:

- Rolling hourly/weekly/monthly headroom per replica
- Same-model replica saturation and skew detection
- Cost/budget intelligence

### Guardrails constrain, not route

Guardrails emit policy constraints (`local-only`, `excludeProviders`, `requireJsonMode`) that the gateway selector must satisfy. Guardrails do not contain selection algorithms or replica registries.

## Local-First Routing Policy

| Task Tier                                                                   | Local Bonus  | Behavior                                         |
| --------------------------------------------------------------------------- | ------------ | ------------------------------------------------ |
| `micro`                                                                     | +100         | Always prefer local (classifications, lookups)   |
| `small`                                                                     | +80          | Strongly prefer local (summarization)            |
| `mid`                                                                       | +20          | Slight local preference if capable (coding)      |
| `frontier`                                                                  | +0           | No preference — use best cloud model (synthesis) |
| Configurable via `ModelSelectionConstraints.localPreference`: `'preferred'` | `'required'` | `'disabled'`.                                    |

## Client API

The `ModelGatewayClient` exposes three invocation methods:

| Method | Model Selection | Replica Selection | Use Case |
|---|---|---|---|
| `callByTier(tier, useCase, request)` | Tier-aware selector | Replica scorer | Normal execution |
| `callLogicalModel(logicalModelId, request)` | Skipped (model pinned) | Replica scorer | Known model |
| `callReplica(replicaId, request)` | Skipped (replica pinned) | Skipped — direct pin | Debug/testing |

See [package docs](../packages/gateway.md) for detailed examples.

## Implementation Plan (7 Batches)

| Batch | Packages | Focus |
|---|---|---|
| **GW-0** | gateway | Remove `ProviderTier` abstraction from types and strategies |
| **GW-1** | gateway | Define `LogicalModel`, `ModelReplica`, registries |
| **GW-2** | gateway | Local backend discovery (Apfel, Ollama, Jan) and health tracking |
| **GW-3** | gateway | Replica scoring (`computeReplicaScore`), tier-aware selection, spillover |
| **GW-4** | gateway | Client API (`callByTier`, `callLogicalModel`, `callReplica`), diagnostics |
| **TKN-0–3** | tokenomics | Replica identity normalization, rolling windows, headroom API |
| **RT-1–2** | runtime | Model lifecycle events, routing-aware checkpoint/retry state |
| **ORCH-1–2** | orchestrator | `TaskTier = ModelTier`, `GatewayBackedModelRouter`, failover policy |
| **GR-1** | guardrails | Routing policy constraints (`local-only`, `excludeProviders`, etc.) |

Total: ~38–48h implementation effort across all packages.

Legacy Phase 0–3.5 docs are historical milestones only; this architecture is the active routing authority.

## Related Documents

- [Cross-package plan (source of truth)](https://github.com/selfagency/agentsy/blob/main/plan/34-CROSS-PACKAGE-MODEL-REPLICA-ROUTING-PLAN.md)
- [Gateway package docs](../packages/gateway.md)
- [Gateway package docs](../packages/gateway.md)
- [Architecture overview](./index.md)
