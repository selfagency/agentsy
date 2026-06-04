import type { NormalizerProvider, UniversalClient } from '@agentsy/providers';
import type { CompletionRequest, CompletionResponse, ProviderRetryPolicy } from '@agentsy/types';
import { z } from 'zod';

export const StrategyNameSchema = z.enum([
  'adaptive',
  'round-robin',
  'weighted',
  'least-connections',
  'latency',
  'priority-fallback',
  'cost-based'
]);
export const ProviderStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);

const ProviderCapabilitiesSchema = z.object({
  maxCompletionTokens: z.number().int().positive().optional(),
  maxPromptTokens: z.number().int().positive().optional(),
  supportsCodeExecution: z.boolean().optional(),
  supportsImages: z.boolean().optional(),
  supportsJsonMode: z.boolean().optional(),
  supportsStreaming: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional()
});

export const ProviderEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.custom<NormalizerProvider>(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
  capabilities: ProviderCapabilitiesSchema.optional(),
  retryPolicy: z.custom<ProviderRetryPolicy>().optional(),
  /**
   * Provider tier for tier-aware routing. Local inference backends
   * (apfel, ollama, vllm, lm-studio) typically set this to `micro`.
   * Optional — when omitted, the tier-aware strategy falls back to
   * `DEFAULT_PROVIDER_TIERS` for built-in ids or treats the entry
   * as `mid` for unknown ids.
   */
  tier: z.enum(['micro', 'small', 'mid', 'frontier']).optional()
});

export type StrategyName = z.infer<typeof StrategyNameSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

export interface ProviderUsageSnapshot {
  averageLatencyMs?: number;
  concurrencyRemaining?: number;
  errorRate?: number;
  lastUsedAt?: string;
  providerId: string;
  rpmRemaining?: number;
  tpmRemaining?: number;
}

export interface RoutingState {
  providerCount: number;
  providerId: string;
  providerStatus: ProviderStatus;
  strategy: StrategyName;
}

export interface LoadBalancerConfig {
  circuitBreaker?: {
    failureThreshold?: number;
    resetAfterMs?: number;
  };
  model?: string;
  providers: ProviderEntry[];
  retry?: ProviderRetryPolicy;
  strategy?: StrategyName;
}

export interface LoadBalancedClient extends UniversalClient {
  createModelSwitcher(): import('./switcher.js').ModelSwitcher;
  getMetricsProviderAggregate(
    providerId: string
  ): import('./observability/metrics-collector.js').ProviderAggregate | undefined;
  getMetricsSnapshot(): import('./observability/metrics-collector.js').MetricsSnapshot;
  getRoutingState(): RoutingState;
  getUsageSnapshot(): ProviderUsageSnapshot[];
  markProviderHealthy(providerId: string): void;
  markProviderUnhealthy(providerId: string): void;
  /**
   * Swap the active routing strategy at runtime. Subsequent
   * `complete()` / `stream()` calls use the new strategy; the
   * in-flight retry/failover loop is unaffected (it has already
   * picked a provider for the current call).
   */
  setStrategy(name: StrategyName, options?: import('./strategies/strategies.js').StrategyOptions): void;
  shutdown(): Promise<void>;
}

export interface LoadBalancedClientFactory {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): Promise<Awaited<UniversalClient['stream']>>;
}
