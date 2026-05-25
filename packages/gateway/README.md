# @agentsy/gateway

Load-balanced provider routing, health tracking, and failover primitives for `@agentsy`.

## Status

Early foundation. Public API is intentionally minimal until routing, profiles, and strategy layers land.

## Current surface

- `createLoadBalancedClient()`
- `LoadBalancedClient`
- `LoadBalancerConfig`
- `LoadBalancerConfigSchema`
- `ProviderEntry`
- `RoutingState`
- `ProviderStatus`
- `ProviderUsageSnapshot`
- `StrategyName`

## Next steps

The next implementation slices are provider registry resolution, profile detection, health tracking, and CLI wiring.
