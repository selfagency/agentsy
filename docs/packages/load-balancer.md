# `@agentsy/load-balancer`

- **Status:** Internal
- **Role:** Provider pooling, health tracking, circuit breaking, routing, and failover orchestration

## Where it fits

`@agentsy/load-balancer` sits between config-driven provider selection and the canonical provider HTTP client. It stays focused on routing decisions, health state, and failover policy; it does not own provider transport itself.

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
import { createLoadBalancedClient } from '@agentsy/load-balancer';

const client = createLoadBalancedClient({
  providers: [
    { id: 'openai', name: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions' }
  ]
});

const state = client.getRoutingState();
```
