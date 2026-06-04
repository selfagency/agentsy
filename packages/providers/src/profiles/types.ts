import { z } from 'zod';
import type { NormalizerProvider, ProviderCapabilities, ProviderRetryPolicy } from '../index.js';

const errorClassifierSchema = z.custom<(status: number, body?: string) => string>();

/**
 * Where a usage probe fetches data from. Mirrors CodexBar's fetch-kind
 * taxonomy so providers can declare HTTP, local, and CLI probes uniformly.
 */
export type UsageProbeKind = 'api' | 'local' | 'cli';

/**
 * Per-provider usage data source. Replaces the previous `usageProbe: string`
 * with a structured descriptor so DeepInfra, Anthropic, Ollama, etc. can
 * each declare their own quirks without a generic fallback path.
 */
export interface UsageProbe {
  /** Optional auth header prefix (e.g. `Bearer`). */
  authPrefix?: string;
  /** CLI command (for kind=cli). */
  command?: string;
  /** Extra headers to send with the probe request. */
  headers?: Record<string, string>;
  /** Where the probe fetches from. */
  kind: UsageProbeKind;
  /**
   * Optional function to extract usage data from the raw probe response.
   * Returns a normalized snapshot. If absent, the default parser is used.
   */
  parse?: (response: { body: string; headers: Record<string, string> }) => ParsedUsage;
  /** Endpoint path or full URL. Relative paths are joined to `baseUrl`. */
  path: string;
}

/** Normalized usage data extracted from a probe response. */
export interface ParsedUsage {
  creditsRemaining?: number;
  rpmLimit?: number;
  rpmRemaining?: number;
  tpmLimit?: number;
  tpmRemaining?: number;
}

const usageProbeSchema = z.object({
  authPrefix: z.string().optional(),
  command: z.string().min(1).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  kind: z.enum(['api', 'local', 'cli']),
  parse: z.custom<(response: { body: string; headers: Record<string, string> }) => ParsedUsage>().optional(),
  path: z.string().min(1)
}) as unknown as z.ZodType<UsageProbe>;

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
  /** @deprecated Use `usageProbes` instead. Kept for config backward compat. */
  usageProbe: z.string().min(1).optional(),
  usageProbes: z.array(usageProbeSchema).optional()
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
  /** @deprecated Use `usageProbes[].path` instead. */
  usageProbe?: string;
  /**
   * Ordered list of probes the gateway will use to discover the provider's
   * current usage/quota state. Empty array = no probing.
   */
  usageProbes: UsageProbe[];
}
