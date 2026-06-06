/**
 * Detects locally-running inference backends by probing well-known
 * endpoints. Returns `ModelEntry` records for each detected model
 * so the gateway can route to them without manual configuration.
 *
 * Detection targets:
 *   - Ollama (localhost:11434)
 *   - Apfel (localhost:8080)
 *   - Jan AI (localhost:1337)
 *
 * Each backend is probed with a short timeout. Failures are silently
 * skipped — the system degrades gracefully to cloud-only routing.
 */

import type { ModelEntry, ModelReplica, ModelTier } from './types.js';

export interface LocalBackendProfile {
  baseUrl: string;
  healthEndpoint: string;
  id: string;
  modelListPath: string;
  name: string;
  providerId: string;
}

const LOCAL_BACKENDS: LocalBackendProfile[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    providerId: 'ollama',
    baseUrl: 'http://localhost:11434',
    healthEndpoint: '/api/tags',
    modelListPath: 'models'
  },
  {
    id: 'apfel',
    name: 'Apfel',
    providerId: 'apfel',
    baseUrl: 'http://localhost:8080',
    healthEndpoint: '/health',
    modelListPath: 'models'
  },
  {
    id: 'jan',
    name: 'Jan AI',
    providerId: 'jan',
    baseUrl: 'http://localhost:1337',
    healthEndpoint: '/v1/models',
    modelListPath: 'data'
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    providerId: 'lm-studio',
    baseUrl: 'http://localhost:1234',
    healthEndpoint: '/v1/models',
    modelListPath: 'data'
  },
  {
    id: 'local-ai',
    name: 'LocalAI',
    providerId: 'local-ai',
    baseUrl: 'http://localhost:8080',
    healthEndpoint: '/v1/models',
    modelListPath: 'data'
  },
  {
    id: 'vllm',
    name: 'vLLM',
    providerId: 'vllm',
    baseUrl: 'http://localhost:8000',
    healthEndpoint: '/v1/models',
    modelListPath: 'data'
  }
];

export class LocalModelDetector {
  /**
   * Probe all known local backends and return detected models.
   * Each backend is probed with a 2-second timeout. Failures
   * are silently skipped.
   */
  async detectAvailableLocalModels(): Promise<ModelEntry[]> {
    const results: ModelEntry[] = [];
    const probes = LOCAL_BACKENDS.map(backend => this.#probeBackend(backend));
    const outcomes = await Promise.allSettled(probes);

    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled' && outcome.value !== undefined) {
        results.push(...outcome.value.entries);
      }
    }

    return results;
  }

  /**
   * Probe all known local backends and return ModelReplica records.
   * Each detected model becomes a local replica with zero cost.
   */
  async detectLocalReplicas(): Promise<ModelReplica[]> {
    const results: ModelReplica[] = [];
    const probes = LOCAL_BACKENDS.map(backend => this.#probeBackend(backend));
    const outcomes = await Promise.allSettled(probes);

    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled' && outcome.value !== undefined) {
        results.push(...outcome.value.replicas);
      }
    }

    return results;
  }

  async #probeBackend(
    backend: LocalBackendProfile
  ): Promise<{ entries: ModelEntry[]; replicas: ModelReplica[] } | undefined> {
    try {
      const response = await fetch(`${backend.baseUrl}${backend.healthEndpoint}`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as Record<string, unknown>;
      const modelNames = this.#extractModelNames(body, backend.modelListPath);
      if (modelNames.length === 0) {
        return;
      }

      return {
        entries: modelNames.map(name => this.#buildModelEntry(backend, name)),
        replicas: modelNames.map(name => this.#buildModelReplica(backend, name))
      };
    } catch {
      // Backend not reachable — skip silently
    }
  }

  #extractModelNames(body: Record<string, unknown>, path: string): string[] {
    const parts = path.split('.');
    let current: unknown = body;

    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return [];
      }
      // hasOwnProperty guard prevents prototype pollution
      if (!Object.hasOwn(current, part)) {
        return [];
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (!Array.isArray(current)) {
      return [];
    }

    return current.flatMap((entry: unknown) => {
      if (typeof entry === 'string') {
        return [entry];
      }
      if (entry !== null && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        const name = e.name ?? e.id;
        if (typeof name === 'string') {
          return [name];
        }
      }
      return [];
    });
  }

  #buildModelEntry(backend: LocalBackendProfile, modelName: string): ModelEntry {
    return {
      id: `${backend.id}/${modelName}`,
      providerId: backend.providerId,
      modelName,
      tier: this.#inferTier(modelName),
      useCases: ['chat', 'code'],
      cost: { inputPer1MTokens: 0, outputPer1MTokens: 0 },
      capabilities: { tools: false, jsonMode: false, vision: false, audio: false, reasoning: false, embeddings: false },
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      isLocal: true
    };
  }

  #buildModelReplica(backend: LocalBackendProfile, modelName: string): ModelReplica {
    return {
      id: `${backend.id}/${modelName}`,
      logicalModelId: modelName,
      providerId: backend.providerId,
      upstreamModelName: modelName,
      cost: { inputPer1MTokens: 0, outputPer1MTokens: 0 },
      isLocal: true
    };
  }

  #inferTier(modelName: string): ModelTier {
    const name = modelName.toLowerCase();
    if (name.includes('1b') || name.includes('3b') || name.includes('0.5b') || name.includes('tiny')) {
      return 'micro';
    }
    if (name.includes('7b') || name.includes('8b') || name.includes('12b') || name.includes('small')) {
      return 'small';
    }
    if (name.includes('70b') || name.includes('72b') || name.includes('120b') || name.includes('405b')) {
      return 'mid';
    }
    return 'small';
  }
}
