/**
 * Ollama local provider discovery and probing
 */

import type { LocalModelInfo, LocalProviderProbeResult, OllamaProbeOptions } from './types.js';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT = 5000;

export async function probeOllama(options: OllamaProbeOptions = {}): Promise<LocalProviderProbeResult> {
  const baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_URL;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    // Check if Ollama is running
    const versionResponse = await fetch(`${baseUrl}/api/version`, {
      signal: AbortSignal.timeout(timeout)
    });

    if (!versionResponse.ok) {
      return {
        available: false,
        models: [],
        error: `Ollama returned status ${versionResponse.status}`
      };
    }

    const versionData = (await versionResponse.json()) as { version?: string };
    const version = versionData.version;

    // Get list of models
    const modelsResponse = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(timeout)
    });

    if (!modelsResponse.ok) {
      return {
        available: true,
        version,
        models: [],
        error: `Failed to fetch models: ${modelsResponse.status}`
      };
    }

    const modelsData = (await modelsResponse.json()) as {
      models?: Array<{
        name: string;
        model: string;
        size?: number;
        digest?: string;
        details?: {
          parameter_size?: string;
          quantization_level?: string;
        };
      }>;
    };

    const models: LocalModelInfo[] = (modelsData.models ?? []).map(m => ({
      id: m.model,
      name: m.name,
      size: m.size ? formatBytes(m.size) : undefined,
      quantization: m.details?.quantization_level,
      parameters: m.details?.parameter_size
    }));

    return {
      available: true,
      version,
      models
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      models: [],
      error: `Ollama probe failed: ${message}`
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}
