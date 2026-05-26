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
    providers: config.providers,
    ...(config.model !== undefined ? { model: config.model } : {}),
    ...(config.strategy !== undefined ? { strategy: config.strategy } : {}),
    ...(config.circuitBreaker !== undefined ? { circuitBreaker: config.circuitBreaker } : {}),
    ...(config.retry !== undefined ? { retry: config.retry } : {})
  });
}
