import type { CompletionRequest, CompletionResponse, NormalizedChunk } from '@agentsy/types';
import { ProviderHealthRegistry } from './health/provider-health-registry.js';
import { MetricsCollector } from './observability/metrics-collector.js';
import { type QuotaTracker, QuotaTrackerRegistry } from './quota/tracker.js';
import { createProviderRegistry } from './registry/index.js';
import { buildStrategy, retryWithFailover } from './retry.js';
import type { StrategyOptions } from './strategies/strategies.js';
import { ModelSwitcher } from './switcher.js';
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
        successCount: 0,
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
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
  options: {
    /**
     * Optional override for the per-provider client factory. The
     * default wires each provider through
     * `createProviderRegistry(config)`, which constructs a real
     * `UniversalClient` for each entry. Tests inject a mock factory
     * to drive the gateway without hitting the network.
     */
    clientFactory?: (entry: ProviderEntry) => import('@agentsy/providers').UniversalClient;
    strategyOptions?: StrategyOptions;
  } = {}
): LoadBalancedClient {
  if (config.providers.length === 0) {
    return buildNoopClient();
  }

  const registry = createProviderRegistry(config, options.clientFactory);
  const metrics = new MetricsCollector();
  const health = new ProviderHealthRegistry({
    ...(config.circuitBreaker === undefined ? {} : { breaker: config.circuitBreaker }),
    onCircuitTripped: providerId => {
      metrics.recordCircuitTrip(providerId);
    }
  });
  const quota = new QuotaTrackerRegistry();
  const strategy = buildStrategy(config.strategy ?? 'adaptive', options.strategyOptions ?? {});
  const inFlight = new Map<string, number>();
  const maxAttempts = config.retry?.attempts ?? 2;
  // Mutable model pointer: ModelSwitcher rewrites this without
  // rebuilding the provider tree, so `config.model` (frozen) is
  // not the source of truth. Defaults to the config value.
  let currentModel: string = config.model ?? config.providers[0]?.model ?? '';

  function providersForRequest(request: CompletionRequest): ProviderEntry[] {
    const first = config.providers[0];
    if (currentModel.length > 0 && first !== undefined) {
      const overridden: ProviderEntry = { ...first, model: request.model ?? currentModel };
      return [overridden, ...config.providers.slice(1)];
    }
    return config.providers;
  }

  function complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Auto-instrument the call: time the whole retry/failover loop,
    // track the provider that actually served the request, and record
    // one `RequestMetric` per caller-visible call. Failover hops
    // (provider A -> provider B) are recorded as a separate event.
    const startedAt = Date.now();
    let lastTried: ProviderEntry | undefined;
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
        if (lastTried !== undefined && lastTried.id !== entry.id) {
          metrics.recordFailover(entry.id);
        }
        lastTried = entry;
        const client = registry.get(entry.id)?.client;
        if (client === undefined) {
          return Promise.reject(new Error(`No client registered for provider ${entry.id}`));
        }
        return client.complete(request);
      },
      { maxAttemptsPerProvider: maxAttempts }
    ).then(
      (response): CompletionResponse => {
        const providerId = lastTried?.id ?? '<unconfigured>';
        const modelId = lastTried?.model ?? currentModel;
        const metric: import('./observability/metrics-collector.js').RequestMetric = {
          latencyMs: Date.now() - startedAt,
          modelId,
          providerId,
          success: true
        };
        if (response.usage !== undefined) {
          const input = response.usage.inputTokens ?? 0;
          const output = response.usage.outputTokens ?? 0;
          metric.tokens = {
            inputTokens: input,
            outputTokens: output,
            totalTokens: response.usage.totalTokens ?? input + output
          };
        }
        metrics.recordRequest(metric);
        return response;
      },
      (error: unknown): never => {
        const providerId = lastTried?.id ?? '<unconfigured>';
        const modelId = lastTried?.model ?? currentModel;
        metrics.recordRequest({
          latencyMs: Date.now() - startedAt,
          modelId,
          providerId,
          success: false
        });
        throw error;
      }
    );
  }

  function stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
    // Stream instrumentation is a known gap: the call returns
    // immediately with a stream object, so end-to-end timing has to
    // live in the consumer. Until that lands, `stream()` requests do
    // not contribute to the metrics snapshot. The CLI TUI
    // (`streamToStdout`) is the right layer to drive this.
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
    createModelSwitcher(): ModelSwitcher {
      return new ModelSwitcher({
        providers: config.providers,
        setActiveModel(upstreamModel: string, _provider: ProviderEntry): void {
          currentModel = upstreamModel;
        }
      });
    },
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
    getMetricsSnapshot() {
      return metrics.getUsageSnapshot();
    },
    getMetricsProviderAggregate(providerId: string) {
      return metrics.getProviderAggregate(providerId);
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
