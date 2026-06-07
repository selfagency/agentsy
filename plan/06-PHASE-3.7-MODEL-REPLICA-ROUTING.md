# Phase 3.7 — Model-Replica Load Balancing

**Effort:** ~30 hours (6h foundation + 6h tokenomics + 6h selection + 5h runtime/orch + 5h guardrails/test)  
**Scope:** Same-logical-model cross-provider routing with quota-aware replica selection, local-first preference, and spillover fallback  
**Packages:** `@agentsy/gateway`, `@agentsy/tokenomics`, `@agentsy/runtime`, `@agentsy/orchestrator`, `@agentsy/guardrails`  
**Gate:** Same-model multi-account routing working with tokenomics headroom awareness; local-first for micro/small tasks  
**Next:** Phase 4

---

## Overview

Build a routing system that can route the **same logical model** across multiple providers/accounts with quota awareness, local-first preference, and spillover fallback.

**Compatibility stance:** This is a **greenfield rearchitecture** with zero backwards-compatibility obligations. The gateway is unreleased. Existing provider-tier abstractions are **removed, not adapted**. No shims, no aliased types, no deprecated code paths.

---

## Conceptual Model

```text
Logical Model (what you want)
    ↓ refers to
ModelReplica[] (where/how you can get it)
    ↓ scored by
ReplicaScore (cost + health + quota headroom + local bonus)
    ↓ chosen by
ReplicaSelector (best replica for the call)
    ↓ if fail
Spillover (next replica → next model → escalate tier)
```

### Provider

Transport + auth + endpoint only. No tier, no capabilities.

```typescript
export interface ProviderEntry {
  id: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  accountId?: string;
  region?: string;
  tags?: string[];
}
```

### Logical Model

Canonical model identity independent of provider. Carries tier, capabilities.

```typescript
export type ModelTier = 'micro' | 'small' | 'mid' | 'frontier';

export interface LogicalModel {
  id: string;                    // 'claude-sonnet-4', 'gpt-4o-mini'
  tier: ModelTier;
  useCases: Array<'chat' | 'code' | 'reasoning' | 'search' | 'embed' | 'vision'>;
  capabilities: ModelCapabilities;
  contextWindow: number;
  maxOutputTokens: number;
}
```

### ModelReplica

One way to reach a logical model — through a specific provider/account.

```typescript
export interface ModelReplica {
  id: string;                      // 'anthropic-main/claude-sonnet-4'
  logicalModelId: string;          // FK → LogicalModel.id
  providerId: string;              // FK → ProviderEntry.id
  upstreamModelName: string;       // provider-specific API name
  cost: ModelCost;
  isLocal: boolean;
}
```

### Replica Quota Headroom

What remains for routing decisions, provided by tokenomics.

```typescript
export interface ReplicaQuotaSnapshot {
  remainingTokensHour?: number;
  remainingTokensWeek?: number;
  remainingTokensMonth?: number;
  remainingRequestsMinute?: number;
  remainingTokensMinute?: number;
  lastUpdatedAt: string;
  confidence: 'header-derived' | 'tokenomics-derived' | 'estimated';
}
```

---

## Selection Algorithm

```text
1. Orchestrator assigns TaskTier
2. Gateway resolves candidate LogicalModels for that tier
3. For each LogicalModel, gateway resolves candidate Replicas
4. Replicas filtered by: health, policy, capabilities, quota headroom
5. Replicas scored (local bonus + quota score - latency - error - cost)
6. Best replica wins
7. If call fails:
   a. Same LogicalModel, next replica
   b. Next LogicalModel in same tier
   c. Tier escalation if orchestrator allows
```

### Local-First Scoring by Tier

| Tier | Local Bonus | Behavior |
|------|-------------|----------|
| micro | +100 | Strong local preference |
| small | +80 | Strong local preference |
| mid | +20 | Slight preference if capable |
| frontier | +0 | No local preference |

### Quota-Aware Replica Ranking

When multiple replicas serve the same logical model, rank by:

1. Highest quota headroom (avoids exhausting one account)
2. Acceptable latency (< 2× baseline)
3. Lowest error rate
4. Lowest cost
5. Tie-break: round-robin

---

## Package Responsibilities

| Package | Responsibility |
|---|---|
| `@agentsy/gateway` | LogicalModel + Replica registries, scoring, selection, spillover, local detection, availability tracking |
| `@agentsy/tokenomics` | Replica budget windows, headroom computation, per-{replica, account} usage aggregation; gateway **reads** headroom (pull), tokenomics **writes** usage (push via runtime events) |
| `@agentsy/runtime` | Pre/Post model-call lifecycle events, routing metadata in checkpoints, failover-aware retry state |
| `@agentsy/orchestrator` | TaskTier = ModelTier, GatewayBackedModelRouter, tier escalation policy (orchestrator decides escalation, not gateway) |
| `@agentsy/guardrails` | Routing constraint surface (local-only, provider exclusion, compliance rules) |

---

## Phased Implementation

### Phase 1 — Gateway Foundation (6h)

Delete provider-tier abstractions and build LogicalModel/Replica core.

| Task | Module | Effort |
|------|--------|--------|
| **GW-000** | `types.ts` — Delete `ProviderTier`. Define `LogicalModel`, `ModelReplica`. Rename existing `ModelEntry` to match the new split. | 0.5h |
| **GW-001** | `logical-models.ts` — Canonical LogicalModel definitions (gpt-4o-mini, gpt-4o, claude-haiku/sonnet/opus, llama-3.2:1b/3.3:70b, qwen3-coder) with tier, capabilities, context window. | 1h |
| **GW-002** | `replica-registry.ts` — `ReplicaRegistry` storing `ModelReplica[]`, indexed by `logicalModelId` and `providerId`. | 1h |
| **GW-003** | `local-detector.ts` — Already exists. Add `LocalModelDetector` probes (Ollama `:11434`, Apfel `:8080`, Jan AI `:1337`) that register `ModelReplica` entries. | 0.5h |
| **GW-004** | `availability-tracker.ts` — Already exists. Rename `#probeLocal` → `#probe`. Deduplicate probes by `(providerId, baseUrl)`. | 0.5h |
| **GW-005** | `model-registry.ts` — Refactor existing `ModelRegistry` to store `LogicalModel[]`. Add `getModelsByTier()`, `getModelById()`, `getLogicalModel()`. | 1h |
| **Tests** | `__tests__/replica-registry.test.ts` — Index by logical model, index by provider, empty states. | 1h |
| **Tests** | `__tests__/logical-models.test.ts` — Canonical model presence, tier/capability correctness. | 0.5h |

**Gate:** `LogicalModel` + `ModelReplica` types defined. ReplicaRegistry indexed correctly. Local detection produces replicas.

---

### Phase 2 — Tokenomics Headroom (6h)

Add replica-level budget tracking and headroom computation.

| Task | Module | Effort |
|------|--------|--------|
| **TKN-000** | `types.ts` — Normalize usage identity to `{ logicalModelId, replicaId, providerId, accountId }`. Define `ReplicaBudget`. | 1h |
| **TKN-001** | `quotas/headroom.ts` — `ReplicaHeadroomSnapshot` with hourly/weekly/monthly remaining tokens/cost. | 1h |
| **TKN-002** | `quotas/replica-budget.ts` — `ReplicaBudget` with max tokens/cost per window. Load from config or tokenomics defaults. | 1h |
| **TKN-003** | `quotas/usage-aggregator.ts` — Aggregate usage by `(replicaId, window)`. Produce `ReplicaHeadroomSnapshot` from recorded usage + budget. | 1.5h |
| **TKN-004** | `routing/headroom-provider.ts` — Expose `ReplicaHeadroomProvider` with `getReplicaHeadroom(replicaId)` and `getLogicalModelHeadroom(logicalModelId)`. Gateway pulls this during selection. | 1h |
| **TKN-005** | `quotas/windows.ts` — Window algebra: align `Date.now()` to hour/week/month boundaries, slice recorded usage into windows. | 0.5h |

**Gate:** Headroom snapshots computable per replica. Gateway can pull headroom during selection. Usage recorded by replica+account.

---

### Phase 3 — Selection + Spillover (6h)

Build replica scoring, same-model cross-provider balancing, spillover chain.

| Task | Module | Effort |
|------|--------|--------|
| **GW-006** | `score/replica-score.ts` — `computeReplicaScore(replica, context) → number`. Components: local bonus (per tier), quota headroom score, latency penalty, error penalty, cost penalty. All weights tunable via config. | 1.5h |
| **GW-007** | `score/tier-policy.ts` — Local preference by tier. Policy-driven (not hardcoded). Default: micro=strong, small=strong, mid=slight, frontier=none. | 0.5h |
| **GW-008** | `replica-selector.ts` — `ReplicaSelector.selectReplica(logicalModelId, constraints?) → ModelReplica`. Filters by health/capability/quota, scores candidates, picks winner. | 1.5h |
| **GW-009** | `selector.ts` — Refactor existing `DefaultTierAwareModelSelector` to use `ReplicaSelector` internally: resolve LogicalModels for tier → for each, pick best Replica → return pair. | 1h |
| **GW-010** | `spillover.ts` — Spillover chain: same model next replica → same tier next model → escalate tier (if caller allows). | 1h |
| **GW-011** | `client.ts` — Expose `callByTier`, `callLogicalModel`, `callReplica` on `GatewayClient`. | 0.5h |

**Gate:** One logical model, two replicas, one low quota → other chosen. Local model wins micro/small tasks. Spillover works.

---

### Phase 4 — Runtime + Orchestrator (5h)

Model-call lifecycle events, routing-aware checkpoints, orchestrator escalation policy.

| Task | Module | Effort |
|------|--------|--------|
| **RT-001** | `events.ts` — Define `PreModelCall`, `PostModelCall`, `ModelCallFailed`, `ModelReplicaSwitched` event types. Include logicalModelId, replicaId, providerId, estimated/actual tokens. | 1h |
| **RT-002** | `orchestrator-loop.ts` — Emit model-call lifecycle events from hook points. | 1h |
| **RT-003** | `checkpoint.ts` — Extend `RuntimeCheckpoint.metadata` with `selectedLogicalModel`, `selectedReplica`, `attemptedReplicas[]`, `failoverHistory[]`. | 1h |
| **RT-004** | `checkpoint.ts` — Extend `InterruptionCheckpoint` with attempted replica chain so resumed sessions skip exhausted replicas. | 1h |
| **ORCH-001** | `model-router.ts` — Refactor `GatewayBackedModelRouter` to accept tier escalation policy (micro→small→mid→frontier→fail). Orchestrator controls escalation; gateway does not decide it. | 1h |
| **ORCH-002** | `plan.ts` — Record selection intent (task tier, chosen model, chosen replica, fallback chain) in execution state. | 0.5h |
| **ORCH-003** | `recovery.ts` — On model call failure: retry same model next replica → try same tier next model → escalate tier if allowed → pause/escalate to human. | 0.5h |

**Gate:** Model-call events emitted. Checkpoints preserve failover state. Resumed sessions skip exhausted replicas. Escalation policy is orchestrator-controlled.

---

### Phase 5 — Guardrails + Test Hardening (5h)

Routing constraint surface from guardrails, full test matrix, docs, CLI diagnostics.

| Task | Module | Effort |
|------|--------|--------|
| **GR-001** | `types.ts` — Define `RoutingConstraint` type: `localOnly`, `excludeProviders[]`, `requireReasoning`, `requireJsonMode`, `requireVision`. | 0.5h |
| **GR-002** | `enforcer.ts` — Enforce routing constraints before gateway selection. Return contestable `ConstraintViolation` reason codes on failure. | 1h |
| **GW-012** | `diagnostics.ts` — Emit structured routing reasons: why this model/replica won, why others were rejected, quota values used, fallback chain. | 1h |
| **Tests** | Full test matrix: one model two replicas quota skew, local win micro/small, no local for frontier, exhausted replicas spill, mid-session failover resume, constraint enforcement. | 2h |
| **Docs** | Package READMEs updated. Cross-package ADR: "Model-tier + Replica-aware Routing". | 0.5h |

**Gate:** Full test matrix passes. Routing decisions explainable. No provider-tier abstractions remain.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Header-based quota is incomplete | Wrong routing | Combine with tokenomics accounting + confidence flags |
| Local discovery is flaky | False local preference | TTL-based availability + cooldowns |
| Scoring overfits to cost | Poor quality | Include health, latency, policy, tier suitability |
| Tokenomics lags actual usage | Stale headroom | Refresh on every response header ingestion |
| Orchestrator duplicates routing logic | Architectural drift | Enforce gateway-only model selection API |
| GW reads headroom while TK writes it | Race condition | Gateway caches headroom for ≤1 selection cycle; tokenomics writes are synchronous via runtime hook |

---

## Success Criteria

### Functional

- [ ] Same logical model routed across multiple provider/accounts
- [ ] Remaining quota over hour/week/month affects replica selection
- [ ] Local models preferred for micro/small tasks when available
- [ ] Orchestrator requests models by tier, never by provider
- [ ] Runtime preserves routing state across retries/checkpoints
- [ ] Guardrails constraints enforced before selection

### Non-functional

- [ ] Routing decisions explainable (structured diagnostics)
- [ ] No provider-tier abstraction remains anywhere
- [ ] Quota headroom updates timely enough for production routing
- [ ] No circular dependencies introduced
- [ ] Reproducer: `claude-sonnet` across `anthropic-main + secondary + vertex-anthropic` with quota skew picks correctly

---

## Task Summary

| ID | Description | Package | Phase | Effort |
|----|-------------|---------|-------|--------|
| GW-000 | Delete ProviderTier, add LogicalModel/ModelReplica types | gateway | 1 | 0.5h |
| GW-001 | Canonical LogicalModel definitions | gateway | 1 | 1h |
| GW-002 | ReplicaRegistry implementation | gateway | 1 | 1h |
| GW-003 | LocalModelDetector produces replicas | gateway | 1 | 0.5h |
| GW-004 | Deduplicate availability probes | gateway | 1 | 0.5h |
| GW-005 | Refactor ModelRegistry for LogicalModels | gateway | 1 | 1h |
| TKN-000 | Normalize usage identity | tokenomics | 2 | 1h |
| TKN-001 | ReplicaHeadroomSnapshot | tokenomics | 2 | 1h |
| TKN-002 | ReplicaBudget | tokenomics | 2 | 1h |
| TKN-003 | UsageAggregator by replica+window | tokenomics | 2 | 1.5h |
| TKN-004 | ReplicaHeadroomProvider | tokenomics | 2 | 1h |
| TKN-005 | Window algebra | tokenomics | 2 | 0.5h |
| GW-006 | ReplicaScore with tunable weights | gateway | 3 | 1.5h |
| GW-007 | LocalPreference policy by tier | gateway | 3 | 0.5h |
| GW-008 | ReplicaSelector | gateway | 3 | 1.5h |
| GW-009 | Refactor DefaultTierAwareModelSelector | gateway | 3 | 1h |
| GW-010 | Spillover chain | gateway | 3 | 1h |
| GW-011 | GatewayClient callByTier/callModel/callReplica | gateway | 3 | 0.5h |
| RT-001 | Model-call event types | runtime | 4 | 1h |
| RT-002 | Emit events from orchestrator-loop | runtime | 4 | 1h |
| RT-003 | Routing metadata in checkpoints | runtime | 4 | 1h |
| RT-004 | Interruption checkpoint failover state | runtime | 4 | 1h |
| ORCH-001 | Tier escalation policy in model-router | orchestrator | 4 | 1h |
| ORCH-002 | Selection intent in execution state | orchestrator | 4 | 0.5h |
| ORCH-003 | Recovery: retry→spill→escalate→pause | orchestrator | 4 | 0.5h |
| GR-001 | RoutingConstraint type | guardrails | 5 | 0.5h |
| GR-002 | Constraint enforcer | guardrails | 5 | 1h |
| GW-012 | Routing diagnostics | gateway | 5 | 1h |
| Tests | Full matrix (all packages) | all | 5 | 2h |
| Docs | READMEs + cross-package ADR | all | 5 | 0.5h |

## Total: 27 tasks, ~30 hours
