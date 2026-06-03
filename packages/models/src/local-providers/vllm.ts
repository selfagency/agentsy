/**
 * vLLM local provider discovery and probing
 */

import type { LocalModelInfo, LocalProviderProbeResult, VllmProbeOptions } from './types.js';

const DEFAULT_VLLM_URL = 'http://localhost:8000';
const DEFAULT_TIMEOUT = 5000;

export async function probeVllm(options: VllmProbeOptions = {}): Promise<LocalProviderProbeResult> {
  const baseUrl = options.baseUrl ?? DEFAULT_VLLM_URL;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const startedAt = Date.now();

  try {
    // Check if vLLM is running via OpenAI-compatible API
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(timeout)
    });

    if (!modelsResponse.ok) {
      return {
        available: false,
        models: [],
        error: `vLLM returned status ${modelsResponse.status}`
      };
    }

    const modelsData = (await modelsResponse.json()) as {
      object?: string;
      data?: Array<{
        id: string;
        object?: string;
        created?: number;
        owned_by?: string;
      }>;
    };

    // Try to get version info from health endpoint
    let version: string | undefined;
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(timeout)
      });
      if (healthResponse.ok) {
        const healthData = (await healthResponse.json()) as { version?: string };
        version = healthData.version;
      }
    } catch {
      // Health endpoint may not exist, continue without version
    }

    const models: LocalModelInfo[] = (modelsData.data ?? []).map(m => ({
      id: m.id,
      name: m.id
    }));

    return {
      available: true,
      latencyMs: Date.now() - startedAt,
      version,
      models
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      models: [],
      latencyMs: Date.now() - startedAt,
      error: `vLLM probe failed: ${message}`
    };
  }
}
