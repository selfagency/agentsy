/**
 * Local provider discovery and probing types
 */

export interface LocalProviderProbeResult {
  available: boolean;
  version?: string | undefined;
  models: LocalModelInfo[];
  error?: string | undefined;
}

export interface LocalModelInfo {
  id: string;
  name: string;
  size?: string | undefined;
  quantization?: string | undefined;
  contextLength?: number | undefined;
  parameters?: string | undefined;
}

export interface OllamaProbeOptions {
  baseUrl?: string;
  timeout?: number;
}

export interface VllmProbeOptions {
  baseUrl?: string;
  timeout?: number;
}

export interface LocalProviderDiscoveryResult {
  ollama: LocalProviderProbeResult;
  vllm: LocalProviderProbeResult;
  discovered: Array<{
    provider: 'ollama' | 'vllm';
    models: LocalModelInfo[];
  }>;
}
