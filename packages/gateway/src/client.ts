import { createUniversalClient } from '@agentsy/providers';
import type { CompletionRequest, CompletionResponse, NormalizedChunk } from '@agentsy/types';

import type { LoadBalancedClient, LoadBalancerConfig, RoutingState } from './types.js';

function buildRoutingState(config: LoadBalancerConfig): RoutingState {
  const provider = config.providers[0];

  return {
    providerCount: config.providers.length,
    providerId: provider?.id ?? 'unconfigured',
    providerStatus: provider ? 'healthy' : 'unknown',
    strategy: config.strategy ?? 'adaptive'
  };
}

function buildNoopClient(): LoadBalancedClient {
  const routingState: RoutingState = {
    providerCount: 0,
    providerId: 'unconfigured',
    providerStatus: 'unknown',
    strategy: 'adaptive'
  };

  return {
    async complete(_request: CompletionRequest): Promise<CompletionResponse> {
      return {
        content: '',
        model: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      };
    },
    async stream(_request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      return new ReadableStream<NormalizedChunk>({
        start(controller) {
          controller.close();
        }
      });
    },
    getRoutingState(): RoutingState {
      return routingState;
    },
    getUsageSnapshot() {
      return [];
    },
    markProviderHealthy(_providerId: string): void {
      /* noop */
    },
    markProviderUnhealthy(_providerId: string): void {
      /* noop */
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}

export function createLoadBalancedClient(config: LoadBalancerConfig): LoadBalancedClient {
  if (config.providers.length === 0) {
    return buildNoopClient();
  }

  const provider = config.providers[0];
  if (provider === undefined) {
    return buildNoopClient();
  }

  const clientConfig =
    provider.baseUrl === undefined
      ? { provider: provider.provider }
      : { baseUrl: provider.baseUrl, provider: provider.provider };
  const client = createUniversalClient(clientConfig);

  return {
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      return client.complete(request);
    },
    async stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      return client.stream(request);
    },
    getRoutingState(): RoutingState {
      return buildRoutingState(config);
    },
    getUsageSnapshot() {
      return config.providers.map(entry => ({ providerId: entry.id }));
    },
    markProviderHealthy(_providerId: string): void {
      /* noop */
    },
    markProviderUnhealthy(_providerId: string): void {
      /* noop */
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}
