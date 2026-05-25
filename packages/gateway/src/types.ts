import { z } from 'zod';

import type { CompletionRequest, CompletionResponse, ProviderCapabilities, ProviderRetryPolicy } from '@agentsy/types';
import type { NormalizerProvider, UniversalClient } from '@agentsy/providers';

export const StrategyNameSchema = z.enum(['adaptive', 'round-robin', 'weighted', 'least-connections', 'latency', 'priority-fallback', 'cost-based']);
export const ProviderStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);

export const ProviderEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.custom<NormalizerProvider>(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
  capabilities: z.custom<ProviderCapabilities>().optional(),
  retryPolicy: z.custom<ProviderRetryPolicy>().optional()
});

export type StrategyName = z.infer<typeof StrategyNameSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

export interface ProviderUsageSnapshot {
  providerId: string;
  rpmRemaining?: number;
  tpmRemaining?: number;
  concurrencyRemaining?: number;
  averageLatencyMs?: number;
  errorRate?: number;
  lastUsedAt?: string;
}

export interface RoutingState {
  strategy: StrategyName;
  providerId: string;
  providerStatus: ProviderStatus;
  providerCount: number;
}

export interface LoadBalancerConfig {
  providers: ProviderEntry[];
  strategy?: StrategyName;
  model?: string;
  circuitBreaker?: {
    failureThreshold?: number;
    resetAfterMs?: number;
  };
  retry?: ProviderRetryPolicy;
}

export interface LoadBalancedClient extends UniversalClient {
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
