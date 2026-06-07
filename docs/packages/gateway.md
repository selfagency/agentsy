# `@agentsy/gateway`

- **Status:** Internal
- **Role:** Model-tier routing, replica selection, health tracking, circuit breaking, and failover orchestration

## Where it fits

`@agentsy/gateway` is the canonical routing spine. It selects a logical model, selects a concrete replica, and then executes through the provider transport. It stays focused on routing decisions, health state, and failover policy; provider transport remains an execution detail.

See [Routing Architecture](../architecture/routing-architecture.md) for the cross-package model-replica design.

## Key exports

- `createLoadBalancedClient`
- `LoadBalancedClient`
- `LoadBalancerConfig`
- `LoadBalancerConfigSchema`
- `ProviderEntry`
- `RoutingState`
- `ProviderStatus`
- `ProviderUsageSnapshot`
- `StrategyName`
- `AllProvidersExhaustedError`

## Use it when

- you need one provider client that can route across multiple configured providers
- you want provider health, circuit breaking, and failover state in one place
- you need CLI-visible routing diagnostics or per-provider usage snapshots

## Common neighbors

- Upstream: `@agentsy/providers`, `@agentsy/models`, `@agentsy/secrets`, `@agentsy/observability`
- Downstream: `@agentsy/cli`, `@agentsy/plugins`

## Example

```ts
import { createLoadBalancedClient } from '@agentsy/gateway';

const client = createLoadBalancedClient({
  providers: [
    { id: 'openai', name: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions' }
  ]
});

const state = client.getRoutingState();
```

## Replica-Routing Architecture

The gateway is the **single routing authority** — it owns all model-selection and replica-selection logic. Three client methods provide increasing levels of routing control:

### `callByTier(tier, useCase, request)`

Full automatic routing. The gateway selects a logical model using the tier-aware selector, then selects the best replica using the replica scorer. Normal execution path.

```
orchestrator → callByTier('mid', 'code', request)
  → tier-aware selector: resolve (mid, code) → logical model
  → replica registry: resolve logical model → candidate replicas
  → replica scorer: filter (health, quota, policy) → score → pick best
  → execute provider call
  → return { response, selection }
```

### `callLogicalModel(logicalModelId, request)`

Pin a specific logical model but let the gateway select the replica. Use when the caller knows which model is needed.

```
callLogicalModel('claude-sonnet-4', request)
  → validate logical model exists
  → replica registry: resolve 'claude-sonnet-4' → candidate replicas
  → replica scorer: pick best replica
  → execute provider call
  → return { response, selection }
```

### `callReplica(replicaId, request)`

Direct pin — no model or replica selection. Use for debugging, testing, or explicit routing.

```
callReplica('anthropic-main/claude-sonnet-4', request)
  → look up replica by id
  → execute provider call directly
  → return { response, selection }
```

### How selection interacts with the stack

- **Tier-aware selection** (`DefaultTierAwareModelSelector`): resolves a `(tier, useCase)` pair to the best `ModelEntry`. Considers local preference, capability requirements, and cost.
- **Replica selection** (`DefaultReplicaSelector`): given candidate replicas for a logical model, filters by health and quota headroom, then scores by local bonus, latency, cost, and error rate.
- **Spillover**: when the selected replica fails, the gateway tries the next-best replica for the same logical model, then the next logical model in the same tier. Tier escalation is controlled by the orchestrator.
- **Each selection returns `ModelSelectionResult`** with the winning replica and a list of rejected candidates with reasons — making every routing decision explainable.

See [Routing Architecture](../architecture/routing-architecture.md) for the full cross-package design.
