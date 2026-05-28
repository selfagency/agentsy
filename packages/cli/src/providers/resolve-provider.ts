import { createLoadBalancedClient, type LoadBalancedClient, type LoadBalancerConfig } from '@agentsy/gateway';

export interface CliProviderConfig {
  circuitBreaker?: LoadBalancerConfig['circuitBreaker'];
  model?: string;
  providers: LoadBalancerConfig['providers'];
  retry?: LoadBalancerConfig['retry'];
  strategy?: LoadBalancerConfig['strategy'];
}

export function resolveProviderClient(config: CliProviderConfig): LoadBalancedClient {
  return createLoadBalancedClient({
    providers: config.providers,
    ...(config.model === undefined ? {} : { model: config.model }),
    ...(config.strategy === undefined ? {} : { strategy: config.strategy }),
    ...(config.circuitBreaker === undefined ? {} : { circuitBreaker: config.circuitBreaker }),
    ...(config.retry === undefined ? {} : { retry: config.retry })
  });
}
