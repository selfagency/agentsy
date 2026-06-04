import type { NormalizerProvider, UniversalClient } from '@agentsy/providers';
import type { CompletionRequest, CompletionResponse, ProviderCapabilities, ProviderRetryPolicy } from '@agentsy/types';
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

export const ProviderEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.custom<NormalizerProvider>(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
  capabilities: z.custom<ProviderCapabilities>().optional(),
  retryPolicy: z.custom<ProviderRetryPolicy>().optional()
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
  getRoutingState(): RoutingState;
  getUsageSnapshot(): ProviderUsageSnapshot[];
  markProviderHealthy(providerId: string): void;
  markProviderUnhealthy(providerId: string): void;
  shutdown(): Promise<void>;
}

export interface LoadBalancedClientFactory {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): Promise<Awaited<UniversalClient['stream']>>;
}
