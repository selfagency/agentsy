import { createLoadBalancedClient, type LoadBalancerConfig, type LoadBalancedClient } from '@agentsy/gateway';

export interface CliProviderConfig {
  providers: LoadBalancerConfig['providers'];
  strategy?: LoadBalancerConfig['strategy'];
  model?: string;
  circuitBreaker?: LoadBalancerConfig['circuitBreaker'];
  retry?: LoadBalancerConfig['retry'];
}

export function resolveProviderClient(config: CliProviderConfig): LoadBalancedClient {
  return createLoadBalancedClient({
    circuitBreaker: config.circuitBreaker,
    model: config.model,
    providers: config.providers,
    retry: config.retry,
    strategy: config.strategy
  });
}
