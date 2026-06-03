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

/**
 * Discover all available local providers (Ollama, vLLM)
 */
export async function discoverLocalProviders(
  options: { ollama?: OllamaProbeOptions; vllm?: VllmProbeOptions } = {}
): Promise<LocalProviderDiscoveryResult> {
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

  return {
    ollama,
    vllm,
    discovered
  };
}
