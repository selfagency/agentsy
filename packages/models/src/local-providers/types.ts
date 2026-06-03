/**
 * Local provider discovery and probing types
 */

export interface LocalProviderProbeResult {
  available: boolean;
  error?: string | undefined;
  latencyMs?: number | undefined;
  models: LocalModelInfo[];
  version?: string | undefined;
}

export interface LocalModelInfo {
  contextLength?: number | undefined;
  id: string;
  name: string;
  parameters?: string | undefined;
  quantization?: string | undefined;
  size?: string | undefined;
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
  discovered: Array<{
    provider: 'ollama' | 'vllm';
    models: LocalModelInfo[];
  }>;
  ollama: LocalProviderProbeResult;
  vllm: LocalProviderProbeResult;
}
