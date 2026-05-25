import type { NormalizerProvider } from '@agentsy/providers';
import type { ProviderCapabilities, ProviderRetryPolicy } from '@agentsy/types';
import { z } from 'zod';

const errorClassifierSchema = z.custom<(status: number, body?: string) => string>();

export const ProviderProfileConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  capabilities: z.custom<ProviderCapabilities>().optional(),
  errorClassifier: errorClassifierSchema.optional(),
  headers: z.record(z.string(), z.string()).optional(),
  id: z.string().min(1),
  model: z.string().min(1).optional(),
  name: z.string().min(1),
  provider: z.custom<NormalizerProvider>(),
  retryPolicy: z.custom<ProviderRetryPolicy>().optional(),
  usageProbe: z.string().min(1).optional()
});

export type ProviderProfileConfig = z.infer<typeof ProviderProfileConfigSchema>;

export interface ProviderProfile {
  baseUrl?: string;
  capabilities?: ProviderCapabilities;
  errorClassifier: (status: number, body?: string) => string;
  headers: Record<string, string>;
  id: string;
  model?: string;
  name: string;
  provider: NormalizerProvider;
  retryPolicy?: ProviderRetryPolicy;
  usageProbe?: string;
}
