import type { ProviderEntry } from '../types.js';

/**
 * Minimal local-platform profile. The full `PlatformProfile` is
 * defined by Phase 17 (`@agentsy/orchestrator/on-device`); the
 * gateway accepts this minimum shape so it can be wired before
 * Phase 17 is implemented, and so unit tests don't need a heavy
 * import.
 *
 * Only the fields the gateway inspects are required. Everything
 * else on a real `PlatformProfile` is ignored.
 */
export interface LocalPlatformProfile {
  /**
   * Accelerators / backends detected on the host. Each entry is
   * an opaque backend id (e.g. `apfel`, `ollama`, `vllm`,
   * `lm-studio`, `local-ai`) with the capabilities the gateway
   * needs to decide whether to register a provider.
   */
  accelerators?: readonly LocalAccelerator[];
}

export interface LocalAccelerator {
  /**
   * Whether the backend is currently reachable. Detected by
   * Phase 17 platform discovery (HTTP probe of `/health`,
   * `/api/tags`, etc.). When false, the gateway does not
   * register a provider for this accelerator.
   */
  available?: boolean;
  /**
   * Default base URL. Overrides the built-in default for the
   * backend. Useful for non-default ports.
   */
  baseUrl?: string;
  /**
   * Default context window for the local model. Used to set
   * `ProviderEntry.capabilities` so tier-aware routing can
   * reject requests that would exceed the local model's
   * context.
   */
  contextWindow?: number;
  /**
   * Backend id. Matches one of the keys in
   * `LOCAL_BACKEND_PROFILES`. Unknown ids are skipped.
   */
  id: string;
}

/**
 * Built-in defaults for each known local backend. The gateway
 * uses these when registering a provider so the user doesn't have
 * to specify every field.
 */
export interface LocalBackendProfile {
  baseUrl: string;
  contextWindow: number;
  defaultModel: string;
  displayName: string;
  kind: 'openai-compatible' | 'anthropic-compatible';
  provider: 'openai' | 'anthropic' | 'ollama';
}

export const LOCAL_BACKEND_PROFILES: Readonly<Record<string, LocalBackendProfile>> = {
  apfel: {
    baseUrl: 'http://127.0.0.1:11435/v1',
    contextWindow: 32_000,
    defaultModel: 'apfel-1.5b',
    displayName: 'APFEL (Apple Silicon)',
    kind: 'openai-compatible',
    provider: 'openai'
  },
  'lm-studio': {
    baseUrl: 'http://127.0.0.1:1234/v1',
    contextWindow: 8000,
    defaultModel: 'qwen2.5-7b',
    displayName: 'LM Studio',
    kind: 'openai-compatible',
    provider: 'openai'
  },
  'local-ai': {
    baseUrl: 'http://127.0.0.1:8080/v1',
    contextWindow: 4000,
    defaultModel: 'llama-3.2-3b',
    displayName: 'LocalAI',
    kind: 'openai-compatible',
    provider: 'openai'
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434/v1',
    contextWindow: 8000,
    defaultModel: 'llama3.2',
    displayName: 'Ollama',
    kind: 'openai-compatible',
    provider: 'openai'
  },
  vllm: {
    baseUrl: 'http://127.0.0.1:8000/v1',
    contextWindow: 16_000,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    displayName: 'vLLM',
    kind: 'openai-compatible',
    provider: 'openai'
  }
};

export interface RegisterLocalProvidersOptions {
  /**
   * Override the default context window for any registered
   * backend. Useful when the locally-loaded model supports a
   * larger context than the backend's default.
   */
  defaultContextWindow?: number;
  /**
   * Optional explicit ordering. The first id in this list becomes
   * the preferred local backend. Useful when multiple backends
   * are available and the user wants to bias toward one (e.g.
   * apfel on Apple Silicon over ollama).
   */
  preferProvider?: 'apfel' | 'ollama' | 'vllm' | 'lm-studio' | 'local-ai';
}

export interface RegisterLocalProvidersResult {
  /**
   * Provider entries that were registered, in preference order
   * (preferred first). Empty when no backends are detected.
   */
  providers: ProviderEntry[];
  /**
   * Number of providers that were registered. Zero is a valid
   * outcome when no local backends are detected.
   */
  registered: number;
}

/**
 * Register providers for every available local backend detected
 * in `profile.accelerators`. Each registered provider has
 * `tier: 'micro'` so the tier-aware strategy prefers it for
 * micro / small tasks. Backends that fail the availability check
 * are silently skipped; the function never throws on detection
 * failures.
 *
 * The function mutates the supplied `entries` array (append
 * order: preferred first, then the rest in declared order) and
 * returns a summary. The caller is expected to pass the mutated
 * array to `LoadBalancerConfig.providers`.
 */
export function registerLocalProviders(
  profile: LocalPlatformProfile,
  entries: ProviderEntry[],
  options: RegisterLocalProvidersOptions = {}
): RegisterLocalProvidersResult {
  const detected = profile.accelerators ?? [];
  const candidates: { accelerator: LocalAccelerator; profile: LocalBackendProfile }[] = [];
  for (const accelerator of detected) {
    if (accelerator.available === false) {
      continue;
    }
    const backendProfile = LOCAL_BACKEND_PROFILES[accelerator.id];
    if (backendProfile === undefined) {
      continue;
    }
    candidates.push({ accelerator, profile: backendProfile });
  }

  if (candidates.length === 0) {
    return { providers: [], registered: 0 };
  }

  if (options.preferProvider !== undefined) {
    candidates.sort((a, b) => {
      const aIsPreferred = a.accelerator.id === options.preferProvider ? 0 : 1;
      const bIsPreferred = b.accelerator.id === options.preferProvider ? 0 : 1;
      return aIsPreferred - bIsPreferred;
    });
  }

  const result: ProviderEntry[] = [];
  for (const { accelerator, profile: backendProfile } of candidates) {
    const baseUrl = accelerator.baseUrl ?? backendProfile.baseUrl;
    const contextWindow = options.defaultContextWindow ?? accelerator.contextWindow ?? backendProfile.contextWindow;
    const entry: ProviderEntry = {
      id: `local-${accelerator.id}`,
      name: `${backendProfile.displayName} (local)`,
      provider: backendProfile.provider,
      baseUrl,
      model: backendProfile.defaultModel
    };
    if (contextWindow > 0) {
      entry.capabilities = {
        supportsStreaming: true,
        supportsTools: false
      };
    }
    result.push(entry);
  }

  entries.push(...result);
  return { providers: result, registered: result.length };
}
