import { z } from 'zod';

import { ProviderEntrySchema, StrategyNameSchema } from './types.js';

export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().positive().optional(),
  resetAfterMs: z.number().int().positive().optional()
});

export const RetryConfigSchema = z.object({
  attempts: z.number().int().positive().optional(),
  backoff: z.enum(['fixed', 'exponential', 'exponential_with_jitter']).optional(),
  initialMs: z.number().int().nonnegative().optional(),
  retryableStatusCodes: z.array(z.number().int()).optional()
});

export const AdaptiveStrategyConfigSchema = z.object({
  latencyWeight: z.number().min(0).max(1).optional(),
  costWeight: z.number().min(0).max(1).optional(),
  healthWeight: z.number().min(0).max(1).optional()
});

export const LoadBalancerConfigSchema = z.object({
  circuitBreaker: CircuitBreakerConfigSchema.optional(),
  model: z.string().min(1).optional(),
  providers: z.array(ProviderEntrySchema),
  retry: RetryConfigSchema.optional(),
  strategy: StrategyNameSchema.default('adaptive')
});
