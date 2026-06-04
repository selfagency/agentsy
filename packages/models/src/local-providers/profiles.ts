import type { LocalProviderProfile } from './profiles.types.js';

const LOCAL_PROVIDER_PROFILES: readonly LocalProviderProfile[] = [
  {
    defaultBaseUrl: 'http://localhost:11434',
    displayName: 'Ollama',
    healthEndpoint: '/api/version',
    id: 'ollama',
    modelsEndpoint: '/api/tags',
    protocol: 'ollama-native',
    requiresApiKeyByDefault: false,
    supportsApiKey: false,
    supportsEmbeddings: true,
    supportsStreaming: true,
    supportsTools: true
  },
  {
    defaultBaseUrl: 'http://localhost:8000',
    displayName: 'vLLM',
    healthEndpoint: '/health',
    id: 'vllm',
    modelsEndpoint: '/v1/models',
    protocol: 'openai-compatible',
    requiresApiKeyByDefault: false,
    supportsApiKey: true,
    supportsEmbeddings: true,
    supportsResponsesApi: false,
    supportsStreaming: true,
    supportsTools: true
  }
] as const;

export function listLocalProviderProfiles(): readonly LocalProviderProfile[] {
  return LOCAL_PROVIDER_PROFILES;
}

export function getLocalProviderProfile(providerId: string): LocalProviderProfile | undefined {
  return LOCAL_PROVIDER_PROFILES.find(profile => profile.id === providerId);
}
