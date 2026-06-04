import type { CompletionRequest, CompletionResponse, NormalizedChunk } from '@agentsy/types';
import { ProviderHealthRegistry } from './health/provider-health-registry.js';
import { type QuotaTracker, QuotaTrackerRegistry } from './quota/tracker.js';
import { createProviderRegistry } from './registry/index.js';
import { buildStrategy, retryWithFailover } from './retry.js';
import type { StrategyOptions } from './strategies/strategies.js';
import type { LoadBalancedClient, LoadBalancerConfig, ProviderEntry, RoutingState } from './types.js';

function buildRoutingState(config: LoadBalancerConfig, health: ProviderHealthRegistry): RoutingState {
  const primary = config.providers[0];
  if (primary === undefined) {
    return {
      providerCount: 0,
      providerId: 'unconfigured',
      providerStatus: 'unknown',
      strategy: config.strategy ?? 'adaptive'
    };
  }
  const status = health.getStatus(primary.id);
  return {
    providerCount: config.providers.length,
    providerId: primary.id,
    providerStatus: status.status,
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
      return Promise.resolve({
        content: '',
        model: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      });
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

export interface GatewayClientInternals {
  readonly health: ProviderHealthRegistry;
  readonly quota: QuotaTrackerRegistry;
  readonly registry: ProviderRegistry;
}

/**
 * Build the load-balanced client. The gateway:
 * - holds a per-provider `UniversalClient` in `ProviderRegistry`,
 * - tracks health via `ProviderHealthRegistry` (circuit-breaker per provider),
 * - tracks rate-limit budget via `QuotaTracker` (one tracker per provider),
 * - uses the configured `StrategyName` to pick the next provider,
 * - retries each provider up to `retry.maxAttempts` times before
 *   failing over; surfaces `AllProvidersExhaustedError` if every
 *   provider has been tried.
 */
export function createLoadBalancedClient(
  config: LoadBalancerConfig,
  options: { strategyOptions?: StrategyOptions } = {}
): LoadBalancedClient {
  if (config.providers.length === 0) {
    return buildNoopClient();
  }

  const registry = createProviderRegistry(config);
  const health = new ProviderHealthRegistry({
    ...(config.circuitBreaker === undefined ? {} : { breaker: config.circuitBreaker })
  });
  const quota = new QuotaTrackerRegistry();
  const strategy = buildStrategy(config.strategy ?? 'adaptive', options.strategyOptions ?? {});
  const inFlight = new Map<string, number>();
  const maxAttempts = config.retry?.attempts ?? 2;

  function providersForRequest(request: CompletionRequest): ProviderEntry[] {
    const first = config.providers[0];
    if (config.model !== undefined && first !== undefined) {
      const overridden: ProviderEntry = { ...first, model: request.model ?? config.model };
      return [overridden, ...config.providers.slice(1)];
    }
    return config.providers;
  }

  function complete(request: CompletionRequest): Promise<CompletionResponse> {
    return retryWithFailover(
      {
        health,
        inFlight,
        providers: providersForRequest(request),
        quota: pickTracker(quota, providersForRequest(request)[0]?.id ?? ''),
        request: { model: request.model },
        strategy
      },
      entry => {
        const client = registry.get(entry.id)?.client;
        if (client === undefined) {
          return Promise.reject(new Error(`No client registered for provider ${entry.id}`));
        }
        return client.complete(request);
      },
      { maxAttemptsPerProvider: maxAttempts }
    );
  }

  function stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
    return retryWithFailover(
      {
        health,
        inFlight,
        providers: providersForRequest(request),
        quota: pickTracker(quota, providersForRequest(request)[0]?.id ?? ''),
        request: { model: request.model },
        strategy
      },
      entry => {
        const client = registry.get(entry.id)?.client;
        if (client === undefined) {
          return Promise.reject(new Error(`No client registered for provider ${entry.id}`));
        }
        return client.stream(request);
      },
      { maxAttemptsPerProvider: maxAttempts }
    );
  }

  return {
    complete,
    stream,
    getRoutingState(): RoutingState {
      return buildRoutingState(config, health);
    },
    getUsageSnapshot() {
      return registry.list().map((entry): import('./types.js').ProviderUsageSnapshot => {
        const healthEntry = health.getStatus(entry.providerId);
        const quotaSnapshot = quota.for(entry.providerId).getUsageSnapshot();
        const snapshot: import('./types.js').ProviderUsageSnapshot = {
          providerId: entry.providerId
        };
        if (healthEntry.averageLatencyMs !== undefined) {
          snapshot.averageLatencyMs = healthEntry.averageLatencyMs;
        }
        snapshot.errorRate = healthEntry.requestCount === 0 ? 0 : 1 - healthEntry.uptimeRatio;
        if (quotaSnapshot.rpmLimit > 0) {
          snapshot.rpmRemaining = quotaSnapshot.rpmRemaining;
        }
        if (quotaSnapshot.tpmLimit > 0) {
          snapshot.tpmRemaining = quotaSnapshot.tpmRemaining;
        }
        return snapshot;
      });
    },
    markProviderHealthy(providerId: string): void {
      health.resetCircuit(providerId);
    },
    markProviderUnhealthy(providerId: string): void {
      for (let i = 0; i < 5; i++) {
        health.recordFailure(providerId, 'manually marked unhealthy');
      }
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  };
}

function pickTracker(quota: QuotaTrackerRegistry, providerId: string): QuotaTracker {
  if (providerId.length === 0) {
    return quota.for('__unconfigured__');
  }
  return quota.for(providerId);
}
