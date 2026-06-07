## Greenfield Cross-Package Implementation Plan — Model-Replica Load Balancing

**Feature:** model-tier routing + replica-aware load balancing across providers/accounts + local-first lightweight tasks  
**Status:** Superseded by `plan/34-CROSS-PACKAGE-MODEL-REPLICA-ROUTING-PLAN.md`
**Compatibility stance:** no backwards compatibility obligations; delete incorrect abstractions instead of preserving them  
**Primary packages:** `@agentsy/gateway`, `@agentsy/tokenomics`, `@agentsy/runtime`, `@agentsy/orchestrator`  
**Secondary packages:** `@agentsy/guardrails`, `@agentsy/types`, docs/tests

---

## 1. Executive Summary

Implement a new routing architecture where:

* **tiers belong to models, not providers**
* **logical models** are routed across **multiple replicas**
* a **replica** is one provider/account/backend serving a logical model
* **tokenomics** computes hourly/weekly/monthly headroom per replica
* **gateway** selects the best replica using:
  * local-first policy for micro/small
  * quota headroom
  * health
  * latency
  * cost
* **orchestrator** only requests a model by task tier and use case
* **runtime** emits the lifecycle and checkpoint data needed for retries/failover

This plan explicitly **removes** provider-tier routing and replaces it with **model-tier + model-replica** routing.

---

## 2. Non-Negotiable Architecture Decisions

## 2.1 No provider-tier abstraction

Delete all canonical use of:

* `ProviderTier`
* provider-level tier metadata
* provider-tier routing APIs
* provider-tier fallback logic

A provider may host many model tiers. Tier cannot live there.

## 2.2 Tier is model-level only

Canonical shared tier enum:

```ts
export type ModelTier = "micro" | "small" | "mid" | "frontier";
```

## 2.3 Task tier corresponds to model tier

Orchestrator uses:

```ts
export type TaskTier = ModelTier;
```

Task decomposition determines tier. Gateway chooses a model/replica for that tier.

## 2.4 Replica-aware routing is first-class

The target routing entity is not just “model”, and not just “provider”:

* **LogicalModel** = canonical model identity
* **ModelReplica** = one concrete provider/account/backend serving that model

Routing selects a **replica** for a **logical model**.

## 2.5 Local-first only for lightweight tasks

Default policy:

* `micro`: strong local preference
* `small`: prefer local
* `mid`: slight local preference only if capable
* `frontier`: no local preference

This is a routing policy, not a hardcoded special-case scattered across the codebase.

## 2.6 No orchestrator-owned routing tables

All cost/capability/routing facts live in gateway/tokenomics.  
Orchestrator requests by tier and constraints only.

---

## 3. Target Architecture

```text
Workflow Node / Task
    ↓
@agentsy/orchestrator
    - infers TaskTier
    - infers useCase
    - asks gateway for model/replica
    ↓
@agentsy/gateway
    - resolves tier -> logical models
    - resolves logical model -> replicas
    - scores replicas using:
        local policy
        health
        latency
        cost
        quota headroom
    - executes call through provider transport
    ↓
@agentsy/tokenomics
    - tracks usage by replica/account
    - computes hour/week/month headroom
    - provides routing signals
    ↓
@agentsy/runtime
    - emits model lifecycle events
    - checkpoints routing state
    - supports retry/failover
```

---

## 4. Data Model

## 4.1 Provider

Transport/auth only.

```ts
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

## 4.2 Logical Model

```ts
export interface LogicalModel {
    id: string; // "claude-sonnet-4", "gpt-4o-mini", "llama-3.3-70b"
    tier: ModelTier;
    useCases: Array<"chat" | "code" | "search" | "embed" | "vision">;
    capabilities: ModelCapabilities;
    contextWindow: number;
    maxOutputTokens: number;
    paramCount?: number;
    knowledgeCutoff?: string;
    releaseDate?: string;
}
```

## 4.3 Model Capabilities

```ts
export interface ModelCapabilities {
    tools: boolean;
    jsonMode: boolean;
    vision: boolean;
    audio: boolean;
    reasoning: boolean;
    embeddings: boolean;
}
```

## 4.4 Model Cost

```ts
export interface ModelCost {
    inputPer1MTokens: number;
    outputPer1MTokens: number;
    cachedInputPer1MTokens?: number;
    cacheWritePer1MTokens?: number;
}
```

## 4.5 Model Replica

```ts
export interface ModelReplica {
    id: string; // "anthropic-main/claude-sonnet-4"
    logicalModelId: string;
    providerId: string;
    upstreamModelName: string;
    isLocal: boolean;
    cost: ModelCost;
    health: ReplicaHealthSnapshot;
    quota: ReplicaQuotaSnapshot;
}
```

## 4.6 Health Snapshot

```ts
export interface ReplicaHealthSnapshot {
    available: boolean;
    latencyMs?: number;
    errorRate?: number;
    circuitState?: "closed" | "open" | "half-open";
    lastCheckedAt: string;
}
```

## 4.7 Quota Snapshot

```ts
export interface ReplicaQuotaSnapshot {
    remainingTokensHour?: number;
    remainingTokensWeek?: number;
    remainingTokensMonth?: number;
    remainingRequestsMinute?: number;
    remainingTokensMinute?: number;
    remainingCostHour?: number;
    remainingCostWeek?: number;
    remainingCostMonth?: number;
    lastUpdatedAt: string;
    confidence: "header-derived" | "tokenomics-derived" | "estimated";
}
```

## 4.8 Selection Result

```ts
export interface ModelSelectionResult {
    logicalModelId: string;
    replicaId: string;
    providerId: string;
    selectedBecause: string[];
    rejectedCandidates: Array<{
        id: string;
        reasons: string[];
    }>;
}
```

---

## 5. Package Responsibilities

| Package | Responsibility |
|---|---|
| `@agentsy/gateway` | logical model registry, replica registry, selector, local detection, execution |
| `@agentsy/tokenomics` | usage tracking, rolling windows, quota headroom, cost/budget intelligence |
| `@agentsy/runtime` | model call lifecycle events, checkpointing, retry state |
| `@agentsy/orchestrator` | task tiering, model request intent, failover policy orchestration |
| `@agentsy/guardrails` | policy constraints on routing, not routing logic |
| `@agentsy/types` | shared interfaces if needed |
| `@agentsy/core` | no routing responsibility |

---

## 6. Package-by-Package Implementation

## 6.1 `@agentsy/gateway`

### Goal

Replace provider-centric routing with **model-tier + replica-aware routing**.

### Delete/replace tasks

#### TASK-GW-000 — Remove provider-tier from gateway

**Effort:** ~1h

* delete `ProviderTier`
* remove `ProviderEntry.tier`
* remove provider-tier assumptions from strategies/config/docs
* fail build if provider-tier still referenced

#### TASK-GW-001 — Introduce `LogicalModel`

**Effort:** ~1h

Create canonical logical model definitions for all supported core models.

#### TASK-GW-002 — Introduce `ModelReplica`

**Effort:** ~1h

Create replica type for provider/account/backend bindings.

#### TASK-GW-003 — Build `LogicalModelRegistry`

**Effort:** ~1.5h

Responsibilities:

* return all logical models
* index by tier
* index by use case
* index by alias

Suggested file:

```text
packages/gateway/src/model-registry.ts
```

#### TASK-GW-004 — Build `ReplicaRegistry`

**Effort:** ~1.5h

Responsibilities:

* index replicas by logical model
* index replicas by provider
* return all replicas for a logical model
* support dynamic registration/unregistration of local replicas

Suggested file:

```text
packages/gateway/src/replica-registry.ts
```

#### TASK-GW-005 — Implement local backend detection

**Effort:** ~2h

Detect and register replicas from:

* Apfel
* Ollama
* Jan

Optional extensibility:

* LM Studio
* LocalAI
* vLLM

Suggested file:

```text
packages/gateway/src/local-detector.ts
```

Detector behavior:

* health probe startup
* model list query
* infer logical model mapping where possible
* infer tier from known mapping or size heuristic
* register replicas as `isLocal: true`

#### TASK-GW-006 — Implement availability tracker

**Effort:** ~1.5h

Suggested file:

```text
packages/gateway/src/availability-tracker.ts
```

Behavior:

* background health checks
* TTL caching
* cooldown after repeated failures
* expose current health snapshot per replica

#### TASK-GW-007 — Implement local preference policy

**Effort:** ~1h

Suggested file:

```text
packages/gateway/src/score/tier-policy.ts
```

Policy:

| Tier | Local bonus |
|---|---|
| micro | very high |
| small | high |
| mid | low |
| frontier | none |

#### TASK-GW-008 — Implement quota-aware scoring

**Effort:** ~2h

Suggested file:

```text
packages/gateway/src/score/compute-replica-score.ts
```

Score components:

* local bonus
* quota headroom
* latency
* error rate
* cost
* circuit state

#### TASK-GW-009 — Implement replica selection

**Effort:** ~1.5h

Suggested file:

```text
packages/gateway/src/replica-selector.ts
```

APIs:

```ts
selectReplicaForLogicalModel(...)
selectModelForTier(...)
```

Behavior:

* same logical model, many replicas
* choose least-loaded healthy acceptable replica
* reject exhausted/hot replicas

#### TASK-GW-010 — Implement spillover chain

**Effort:** ~1.5h

Routing fallback order:

1. next replica for same logical model
2. next logical model in same tier
3. next tier only if caller allows

#### TASK-GW-011 — Make client model-centric

**Effort:** ~1.5h

Gateway client should expose:

```ts
callByTier(...)
callLogicalModel(...)
callReplica(...)
getModelSelector()
```

#### TASK-GW-012 — Add routing diagnostics

**Effort:** ~1h

Emit:

* chosen model
* chosen replica
* why chosen
* why alternatives rejected
* whether quota pressure influenced routing
* whether local preference influenced routing

#### TASK-GW-013 — Rewrite gateway docs

**Effort:** ~1h

README and package docs must describe model-tier + replica routing only.

---

## 6.2 `@agentsy/tokenomics`

### Goal

Provide gateway with **replica-specific headroom** and track usage at the correct granularity.

### Delete/replace tasks

#### TASK-TKN-000 — Normalize identity model

**Effort:** ~1h

Every usage record must support:

* `logicalModelId`
* `replicaId`
* `providerId`
* `accountId`

#### TASK-TKN-001 — Define replica budgets

**Effort:** ~1h

Suggested file:

```text
packages/tokenomics/src/quotas/replica-budget.ts
```

```ts
export interface ReplicaBudget {
    replicaId: string;
    logicalModelId: string;
    providerId: string;
    accountId?: string;
    maxTokensHour?: number;
    maxTokensWeek?: number;
    maxTokensMonth?: number;
    maxCostHour?: number;
    maxCostWeek?: number;
    maxCostMonth?: number;
}
```

#### TASK-TKN-002 — Aggregate usage by replica

**Effort:** ~1.5h

Suggested file:

```text
packages/tokenomics/src/quotas/usage-aggregator.ts
```

Compute rolling windows by:

* hour
* week
* month

#### TASK-TKN-003 — Compute headroom snapshots

**Effort:** ~1.5h

Suggested file:

```text
packages/tokenomics/src/quotas/headroom.ts
```

Expose:

```ts
getReplicaHeadroom(replicaId)
getLogicalModelHeadroom(logicalModelId)
```

#### TASK-TKN-004 — Merge header truth + accounting truth

**Effort:** ~1.5h

If provider exposes rate headers:

* ingest them
* reconcile with internal accounting
* assign confidence level

#### TASK-TKN-005 — Add routing signals API

**Effort:** ~1h

Suggested file:

```text
packages/tokenomics/src/routing/headroom-provider.ts
```

This is what gateway consumes.

#### TASK-TKN-006 — Add saturation analytics

**Effort:** ~1h

Track:

* hottest replicas
* skew across same-model replicas
* underused local replicas
* monthly burn-down per account

#### TASK-TKN-007 — Update ledger types

**Effort:** ~1h

Ledger/session records must include:

* logical model used
* replica used
* fallback chain if any

---

## 6.3 `@agentsy/runtime`

### Goal

Emit enough lifecycle to support replica-aware routing and deterministic retries.

#### TASK-RT-000 — Add model call lifecycle events

**Effort:** ~1.5h

Add events:

* `PreModelCall`
* `PostModelCall`
* `ModelCallFailed`
* `ModelReplicaSwitched`

These events should include:

* logical model
* replica
* provider
* estimated tokens
* actual usage if available

#### TASK-RT-001 — Extend checkpoint metadata

**Effort:** ~1h

Checkpoint metadata must store:

* chosen logical model
* chosen replica
* attempted replicas
* retry index
* allowed escalation state

#### TASK-RT-002 — Extend interruption metadata

**Effort:** ~1h

Same as above for interruption/resume.

#### TASK-RT-003 — Add retry-aware execution context

**Effort:** ~1h

Runtime needs a small state object tracking:

* attempted replica IDs
* attempted logical model IDs
* current tier
* whether escalation already happened

#### TASK-RT-004 — Emit tokenomics-friendly post-call data

**Effort:** ~1h

After a model call completes, runtime should emit enough for tokenomics to record usage with replica granularity.

---

## 6.4 `@agentsy/orchestrator`

### Goal

Task tiering + gateway delegation only. No provider knowledge.

#### TASK-ORCH-000 — Define `TaskTier = ModelTier`

**Effort:** ~0.5h

Import from gateway; do not redefine locally.

#### TASK-ORCH-001 — Add `GatewayBackedModelRouter`

**Effort:** ~1h

Suggested file:

```text
packages/orchestrator/src/intelligence/model-router.ts
```

Responsibilities:

* infer use case from task/workflow node
* ask gateway for selection
* return `ModelSelectionResult`

#### TASK-ORCH-002 — Add failover policy

**Effort:** ~1.5h

Ordered behavior:

1. same logical model, next replica
2. another logical model in same tier
3. escalate tier if policy allows
4. abort / ask human

#### TASK-ORCH-003 — Record routing intent in execution state

**Effort:** ~1h

Execution state needs:

* requested tier
* chosen logical model
* chosen replica
* fallback attempts

#### TASK-ORCH-004 — Integrate with recovery

**Effort:** ~1h

Recovery must call back into gateway with prior attempts excluded.

#### TASK-ORCH-005 — Keep orchestrator free of routing facts

**Effort:** ~0.5h

Enforce rule:

* no cost tables
* no provider ranking logic
* no local backend detection in orchestrator

---

## 6.5 `@agentsy/guardrails`

### Goal

Provide constraints, not routing behavior.

#### TASK-GR-000 — Add routing-relevant policy constraints

**Effort:** ~1h

Support constraints such as:

* local only
* exclude certain providers
* require reasoning models
* require JSON mode
* forbid cloud for sensitive tasks

#### TASK-GR-001 — Surface denial reasons

**Effort:** ~0.5h

If no candidate satisfies policy, return explicit reason.

---

## 6.6 `@agentsy/types`

Optional but recommended if cross-package typing gets noisy.

### TASK-TYPES-000 — Promote shared routing types

**Effort:** ~1h

Candidate shared types:

* `ModelTier`
* `LogicalModel`
* `ModelReplica`
* `ReplicaQuotaSnapshot`
* `ModelSelectionResult`

Only do this if it reduces duplication without introducing circularity.

---

## 7. Algorithm Specification

## 7.1 Tier resolution

```text
task -> TaskTier
TaskTier == ModelTier
ModelTier -> candidate LogicalModels
LogicalModel -> candidate Replicas
Replicas -> filtered/scored
best Replica selected
```

## 7.2 Replica score formula

Suggested structure:

\[
score =
w_{local} \cdot localBonus

* w_{quota} \cdot quotaHeadroom
* w_{latency} \cdot latencyPenalty
* w_{error} \cdot errorPenalty
* w_{cost} \cdot costPenalty
\]

Where:

* `localBonus` depends on tier
* `quotaHeadroom` favors accounts with more remaining headroom
* `latencyPenalty` penalizes slow replicas
* `errorPenalty` penalizes unstable replicas
* `costPenalty` discourages expensive replicas when equivalent alternatives exist

## 7.3 Fallback order

For a failed or exhausted replica:

1. next replica of same logical model
2. next logical model in same tier
3. next tier only if orchestrator permits
4. final failure / escalation

---

## 8. Testing Plan

## 8.1 Unit tests

### Gateway

* logical model registry indexes correctly
* replica registry indexes correctly
* local detector discovers Ollama/Apfel/Jan
* availability tracker respects TTL and cooldown
* local bonus changes by tier
* quota-aware scoring prefers higher-headroom replica
* selector chooses another replica for same logical model when one is near exhaustion

### Tokenomics

* usage aggregates by hour/week/month
* replica headroom computed correctly
* confidence labels correct after header reconciliation

### Runtime

* model call lifecycle events emitted
* checkpoint stores attempted replicas
* interruption/resume preserves failover chain

### Orchestrator

* task tier delegated to gateway
* failover order correct
* no direct provider logic

## 8.2 Integration tests

Scenario set:

1. **Same model, two cloud accounts**
   * account A near hourly cap
   * account B healthy
   * route to B

2. **Same model, local + cloud**
   * small task
   * local available
   * route local

3. **Frontier task with local available**
   * local available
   * route cloud frontier

4. **Replica failure**
   * selected replica errors
   * next replica chosen
   * checkpoint preserves attempt history

5. **Policy-constrained routing**
   * local-only task
   * no local replica available
   * clean denial

## 8.3 End-to-end tests

Full session with:

* task decomposition
* gateway selection
* runtime events
* tokenomics usage recording
* retry on alternate replica
* final ledger entry

---

## 9. Acceptance Criteria

### Functional

* same logical model routes across multiple provider/accounts
* quota headroom over hour/week/month influences selection
* local replicas preferred for micro/small
* frontier tasks do not inherit a local bias
* retry avoids already failed replicas
* orchestrator requests by tier, not provider
* tokenomics tracks usage by replica

### Architectural

* no provider-tier abstraction remains
* no compat layer exists
* orchestrator does not own routing facts
* gateway is the single routing authority
* tokenomics is the single headroom authority

### Observability

* routing decisions explainable
* fallback chain visible
* quota influence visible
* local/cloud decision visible

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| stale quota info | reconcile header-derived and accounting-derived values |
| local probes unreliable | TTL caching + cooldowns + health confidence |
| score weights mis-tuned | keep weights configurable and test against fixtures |
| routing logic leaks into orchestrator | enforce gateway-only selection APIs |
| circular dependencies | keep shared types minimal or centralize them carefully |

---

## 11. Suggested File Layout

## Gateway

```text
packages/gateway/src/
├── types.ts
├── logical-models.ts
├── model-registry.ts
├── replica-registry.ts
├── replica-selector.ts
├── local-detector.ts
├── availability-tracker.ts
├── quota-headroom.ts
├── score/
│   ├── compute-replica-score.ts
│   ├── local-bonus.ts
│   └── tier-policy.ts
└── client.ts
```

## Tokenomics

```text
packages/tokenomics/src/
├── quotas/
│   ├── replica-budget.ts
│   ├── usage-aggregator.ts
│   ├── headroom.ts
│   └── windows.ts
├── routing/
│   └── headroom-provider.ts
└── ledger/
    └── types.ts
```

## Runtime

```text
packages/runtime/src/
├── hooks/
│   ├── types.ts
│   └── registry.ts
├── checkpoint.ts
└── interruption.ts
```

## Orchestrator

```text
packages/orchestrator/src/
├── intelligence/
│   └── model-router.ts
├── recovery/
│   └── model-failover.ts
└── types/
    └── routing.ts
```

---

## 12. Task Table Summary

| Package | Task Count | Approx Effort |
|---|---:|---:|
| gateway | 14 | 16–18h |
| tokenomics | 8 | 8–10h |
| runtime | 5 | 4–5h |
| orchestrator | 6 | 4–5h |
| guardrails | 2 | 1–2h |
| types/docs/tests | 4 | 3–4h |

**Total:** ~36–44h

---

## 13. Compatibility Statement

This plan assumes **zero backwards compatibility requirements**.

Therefore:

* incorrect abstractions are removed, not adapted
* no deprecation shims are added
* no transitional APIs are introduced
* all docs/tests should target the final architecture only

---

## 14. Final Recommendation

Implement this as a **greenfield routing spine** centered on:

* `LogicalModel`
* `ModelReplica`
* `ReplicaQuotaSnapshot`
* `ModelSelectionResult`
