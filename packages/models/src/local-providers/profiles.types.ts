export type ProviderProtocol =
  | 'openai-compatible'
  | 'ollama-native'
  | 'anthropic-compatible'
  | 'lmstudio-native'
  | 'node-llama-cpp-native';

export interface LocalProviderProfile {
  defaultBaseUrl: string;
  displayName: string;
  healthEndpoint?: string;
  id: string;
  modelsEndpoint?: string;
  notes?: string[];
  protocol: ProviderProtocol;
  requiresApiKeyByDefault: boolean;
  supportsApiKey: boolean;
  supportsEmbeddings: boolean;
  supportsResponsesApi?: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
}
