import { createUniversalClient } from '@agentsy/providers';
import type { CompletionRequest, CompletionResponse, NormalizedChunk } from '@agentsy/types';

import type { LoadBalancerConfig, LoadBalancedClient, RoutingState } from '../types.js';

export interface ProviderRegistryEntry {
  client: ReturnType<typeof createUniversalClient>;
  providerId: string;
}

export class ProviderRegistry {
  #entries = new Map<string, ProviderRegistryEntry>();

  register(providerId: string, client: ReturnType<typeof createUniversalClient>): void {
    this.#entries.set(providerId, { client, providerId });
  }

  get(providerId: string): ProviderRegistryEntry | undefined {
    return this.#entries.get(providerId);
  }

  list(): ProviderRegistryEntry[] {
    return [...this.#entries.values()];
  }
}

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
      return { content: '', model: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } };
    },
    async stream(_request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      return new ReadableStream<NormalizedChunk>({ start(controller) { controller.close(); } });
    },
    getRoutingState(): RoutingState {
      return routingState;
    },
    getUsageSnapshot() {
      return [];
    },
    markProviderHealthy(_providerId: string): void {},
    markProviderUnhealthy(_providerId: string): void {},
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}

export function createProviderRegistry(config: LoadBalancerConfig): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const provider of config.providers) {
    const clientConfig = provider.baseUrl === undefined
      ? { provider: provider.provider }
      : { baseUrl: provider.baseUrl, provider: provider.provider };
    registry.register(provider.id, createUniversalClient(clientConfig));
  }
  return registry;
}

export function createLoadBalancedClient(config: LoadBalancerConfig): LoadBalancedClient {
  if (config.providers.length === 0) {
    return buildNoopClient();
  }

  const registry = createProviderRegistry(config);
  const primary = config.providers[0];
  if (primary === undefined) {
    return buildNoopClient();
  }

  const primaryEntry = registry.get(primary.id);
  const client = primaryEntry?.client ?? createUniversalClient(primary.baseUrl === undefined
    ? { provider: primary.provider }
    : { baseUrl: primary.baseUrl, provider: primary.provider });

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
      return registry.list().map(entry => ({ providerId: entry.providerId }));
    },
    markProviderHealthy(_providerId: string): void {},
    markProviderUnhealthy(_providerId: string): void {},
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}
