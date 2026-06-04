import { createUniversalClient } from '@agentsy/providers';
import type { CompletionRequest, CompletionResponse, NormalizedChunk } from '@agentsy/types';

import { ModelSwitcher } from '../switcher.js';
import type { LoadBalancedClient, LoadBalancerConfig, RoutingState } from '../types.js';

export interface ProviderRegistryEntry {
  client: ReturnType<typeof createUniversalClient>;
  providerId: string;
}

export class ProviderRegistry {
  readonly #entries = new Map<string, ProviderRegistryEntry>();

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
    complete(_request: CompletionRequest): Promise<CompletionResponse> {
      return Promise.resolve({ content: '', model: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
    },
    stream(_request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      return Promise.resolve(
        new ReadableStream<NormalizedChunk>({
          start(controller) {
            controller.close();
          }
        })
      );
    },
    createModelSwitcher(): ModelSwitcher {
      return new ModelSwitcher({ providers: [], setActiveModel: () => undefined });
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
    getMetricsSnapshot() {
      return {
        circuitTrips: 0,
        failureCount: 0,
        failoverCount: 0,
        latency: { p50: undefined, p95: undefined, p99: undefined, samples: 0 },
        perProvider: [],
        requestCount: 0,
        streamCount: 0,
        streamFailureCount: 0,
        streamSuccessCount: 0,
        successCount: 0,
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalStreamChunks: 0,
        totalStreamDurationMs: 0,
        totalStreamTtfbMs: 0,
        totalTokens: 0
      };
    },
    getMetricsProviderAggregate(_providerId: string) {
      return;
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}

export function createProviderRegistry(
  config: LoadBalancerConfig,
  clientFactory?: (entry: import('../types.js').ProviderEntry) => import('@agentsy/providers').UniversalClient
): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const provider of config.providers) {
    if (clientFactory !== undefined) {
      registry.register(provider.id, clientFactory(provider));
      continue;
    }
    const clientConfig =
      provider.baseUrl === undefined
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
  const client =
    primaryEntry?.client ??
    createUniversalClient(
      primary.baseUrl === undefined
        ? { provider: primary.provider }
        : { baseUrl: primary.baseUrl, provider: primary.provider }
    );

  return {
    complete(request: CompletionRequest): Promise<CompletionResponse> {
      return client.complete(request);
    },
    stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      return client.stream(request);
    },
    createModelSwitcher(): ModelSwitcher {
      return new ModelSwitcher({ providers: config.providers, setActiveModel: () => undefined });
    },
    getRoutingState(): RoutingState {
      return buildRoutingState(config);
    },
    getUsageSnapshot() {
      return registry.list().map(entry => ({ providerId: entry.providerId }));
    },
    markProviderHealthy(_providerId: string): void {
      /* noop */
    },
    markProviderUnhealthy(_providerId: string): void {
      /* noop */
    },
    getMetricsSnapshot() {
      return {
        circuitTrips: 0,
        failureCount: 0,
        failoverCount: 0,
        latency: { p50: undefined, p95: undefined, p99: undefined, samples: 0 },
        perProvider: [],
        requestCount: 0,
        streamCount: 0,
        streamFailureCount: 0,
        streamSuccessCount: 0,
        successCount: 0,
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalStreamChunks: 0,
        totalStreamDurationMs: 0,
        totalStreamTtfbMs: 0,
        totalTokens: 0
      };
    },
    getMetricsProviderAggregate(_providerId: string) {
      return;
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}
