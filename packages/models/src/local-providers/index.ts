/**
 * Local provider discovery and probing
 */

export { probeOllama } from './ollama.js';
export { getLocalProviderProfile, listLocalProviderProfiles } from './profiles.js';
export type {
  LocalProviderProfile,
  ProviderProtocol
} from './profiles.types.js';
export { routeLocalProviders } from './routing.js';
export type {
  LocalModelInfo,
  LocalProviderDiscoveryResult,
  LocalProviderProbeResult,
  OllamaProbeOptions,
  VllmProbeOptions
} from './types.js';
export { probeVllm } from './vllm.js';

import { probeOllama } from './ollama.js';
import type { LocalModelInfo, LocalProviderDiscoveryResult, OllamaProbeOptions, VllmProbeOptions } from './types.js';
import { probeVllm } from './vllm.js';

const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;

interface DiscoveryCacheEntry {
  readonly discoveredAt: number;
  readonly result: LocalProviderDiscoveryResult;
}

let discoveryCache: DiscoveryCacheEntry | undefined;

function hasProbeError(result: LocalProviderDiscoveryResult): boolean {
  return Boolean(result.ollama.error || result.vllm.error);
}

/**
 * Discover all available local providers (Ollama, vLLM)
 */
export async function discoverLocalProviders(
  options: { forceRefresh?: boolean; ollama?: OllamaProbeOptions; vllm?: VllmProbeOptions } = {}
): Promise<LocalProviderDiscoveryResult> {
  const now = Date.now();
  const cached = discoveryCache;
  if (!options.forceRefresh && cached !== undefined && now - cached.discoveredAt < DISCOVERY_CACHE_TTL_MS) {
    return cached.result;
  }

  const [ollama, vllm] = await Promise.all([probeOllama(options.ollama), probeVllm(options.vllm)]);

  const discovered: { provider: 'ollama' | 'vllm'; models: LocalModelInfo[] }[] = [];

  if (ollama.available && ollama.models.length > 0) {
    discovered.push({
      provider: 'ollama' as const,
      models: ollama.models
    });
  }

  if (vllm.available && vllm.models.length > 0) {
    discovered.push({
      provider: 'vllm' as const,
      models: vllm.models
    });
  }

  const result: LocalProviderDiscoveryResult = {
    ollama,
    vllm,
    discovered
  };

  if (hasProbeError(result)) {
    discoveryCache = undefined;
    return result;
  }

  discoveryCache = {
    discoveredAt: now,
    result
  };

  return result;
}

export function clearLocalProviderDiscoveryCache(): void {
  discoveryCache = undefined;
}
