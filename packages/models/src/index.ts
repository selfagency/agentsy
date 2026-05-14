import os from 'node:os';
import path from 'node:path';

// Core types matching models.dev API structure
export interface ModelsDevAPI {
  [providerId: string]: ModelsDevProvider;
}

export interface ModelsDevProvider {
  id: string;
  env: string[];
  npm?: string;
  api: string;
  name: string;
  doc: string;
  models: Record<string, ModelsDevModel>;
}

export interface ModelsDevModel {
  id: string;
  name: string;
  family: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  temperature: boolean;
  knowledge: string;
  release_date: string;
  last_updated: string;
  modalities: {
    input: string[];
    output: string[];
  };
  open_weights: boolean;
  limit: {
    context: number;
    output: number;
  };
  cost: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
}

// Task requirements for model selection
export interface TaskRequirements {
  modality?: 'text' | 'multimodal' | 'code' | 'reasoning';
  capabilities?: {
    tool_calling?: boolean;
    streaming?: boolean;
    image_input?: boolean;
    audio_input?: boolean;
    audio_output?: boolean;
  };
  constraints?: {
    max_cost?: number;
    max_context?: number;
    min_speed?: 'fast' | 'medium' | 'slow';
    preferred_family?: string;
    exclude_family?: string[];
  };
  specialization?: string;
}

// Model selection results
export interface ModelSelectionResult {
  model: string;
  provider: string;
  confidence: number;
  estimatedCost: number;
  capabilities: TaskRequirements['capabilities'];
  reasoning: string;
}

// Simple models.dev client with caching
export class ModelsDevClient {
  private cache?: ModelsDevAPI;
  private lastFetched?: Date;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_FILE = path.join(os.tmpdir(), 'models.dev-cache.json');

  async fetchModelsDevData(force = false): Promise<ModelsDevAPI> {
    // Check cache first
    if (!force && this.cache && this.lastFetched && Date.now() - this.lastFetched.getTime() < this.CACHE_TTL) {
      return this.cache;
    }

    // Try to load from file cache
    try {
      const fs = await import('node:fs/promises');
      const cacheData = await fs.readFile(this.CACHE_FILE, 'utf-8');
      const cached = JSON.parse(cacheData) as ModelsDevAPI;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.cache = cached.data;
        this.lastFetched = new Date(cached.timestamp);
        return this.cache;
      }
    } catch {
      // No cache file or expired
    }

    // Fetch from API
    const response = await fetch('https://models.dev/api.json');
    const data = (await response.json()) as ModelsDevAPI;

    // Save to cache
    try {
      const fs = await import('node:fs/promises');
      const cacheDir = os.tmpdir();
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(this.CACHE_FILE, JSON.stringify({ timestamp: Date.now(), data }), 'utf-8');
    } catch {
      // Failed to save cache, ignore
    }

    this.cache = data;
    this.lastFetched = new Date();
    return data;
  }

  getProvider(providerId: string): ModelsDevProvider | undefined {
    return this.cache?.[providerId];
  }

  getModel(modelId: string): ModelsDevModel | undefined {
    // Parse model ID (format: provider:model or just model)
    const parts = modelId.includes(':') ? modelId.split(':') : [null, modelId];

    if (parts[0]) {
      const provider = this.getProvider(parts[0]);
      return provider?.models[parts[1]];
    }

    // Search for model ID across all providers
    for (const provider of Object.values(this.cache || {})) {
      if (provider.models[modelId]) {
        return provider.models[modelId];
      }
    }
    return undefined;
  }

  listProviders(): ModelsDevProvider[] {
    return Object.values(this.cache ?? {});
  }

  listModels(providerId?: string): ModelsDevModel[] {
    if (providerId) {
      const provider = this.getProvider(providerId);
      return Object.values(provider?.models ?? {});
    }
    return Object.values(this.cache ?? {}).flatMap(p => Object.values(p.models));
  }
}

// Export model selector
export type {
  ModelsDevAPI,
  ModelsDevProvider,
  ModelsDevModel,
  TaskRequirements,
  ModelSelectionResult,
} from './types.js';
export { ModelSelector, modelsDevClient } from './model-selector.js';

// Re-export for convenience
export type {
  ModelsDevAPI,
  ModelsDevProvider,
  ModelsDevModel,
  TaskRequirements,
  ModelSelectionResult,
} from './index.js';

// Singleton instance
export const modelsDevClient = ModelSelector.modelsDevClient;
