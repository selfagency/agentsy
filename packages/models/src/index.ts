import os from 'node:os';
import path from 'node:path';

import type {
  ModelsDevAPI,
  ModelsDevModel,
  ModelsDevProvider,
  TaskRequirements,
  ModelSelectionResult,
} from './types.js';

export type {
  ModelsDevAPI,
  ModelsDevModel,
  ModelsDevProvider,
  TaskRequirements,
  ModelSelectionResult,
};

// Cache structure
interface CacheData {
  timestamp: number;
  data: ModelsDevAPI;
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
      const cached = JSON.parse(cacheData) as CacheData;
      if (cached.timestamp && Date.now() - cached.timestamp < this.CACHE_TTL) {
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

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): ModelsDevProvider | undefined {
    return this.cache?.[providerId];
  }

  /**
   * Get a specific model by ID (supports provider:model or just model format)
   */
  getModel(modelId: string): ModelsDevModel | undefined {
    // Try parsing as provider:model format
    if (modelId.includes(':')) {
      const [providerId, modelName] = modelId.split(':');
      if (providerId && modelName) {
        const provider = this.getProvider(providerId);
        return provider?.models[modelName];
      }
    }

    if (modelId.includes('/')) {
      const [providerId, modelName] = modelId.split('/');
      if (providerId && modelName) {
        const provider = this.getProvider(providerId);
        return provider?.models[modelName];
      }
    }

    // Search for model ID across all providers
    for (const provider of Object.values(this.cache ?? {})) {
      if (provider.models[modelId]) {
        return provider.models[modelId];
      }
    }
    return undefined;
  }

  /**
   * List all providers
   */
  listProviders(): ModelsDevProvider[] {
    return Object.values(this.cache ?? {});
  }

  /**
   * List all models across all providers
   */
  listModels(providerId?: string): ModelsDevModel[] {
    if (providerId) {
      const provider = this.getProvider(providerId);
      return Object.values(provider?.models ?? {});
    }
    return Object.values(this.cache ?? {}).flatMap(provider => Object.values(provider.models));
  }
}

/**
 * Model selector for intelligent model selection based on task requirements
 */
export class ModelSelector {
  private readonly client: ModelsDevClient;

  static readonly modelsDevClient = new ModelsDevClient();

  constructor() {
    this.client = ModelSelector.modelsDevClient;
  }

  /**
   * Select the best model for a given set of task requirements
   */
  async selectModel(requirements: TaskRequirements): Promise<ModelSelectionResult> {
    await this.client.fetchModelsDevData();

    const allModels = this.client.listModels();

    // First filter out routing service providers
    const routingProviders = ['helicone', 'kilo', 'openrouter', 'llmgateway', 'morph', 'auriko', 'firepass', 'xiaomi-token-plan', 'xiaomi-token-plan-cn', 'nano-gpt'];
    const allProviders = Object.keys(this.cache ?? {});
    const originalProviderModels = allModels.filter(model => {
      const provider = this.findProviderForModel(model.id);
      return provider && !routingProviders.includes(provider);
    });

    // Filter models based on requirements
    const suitableModels = originalProviderModels.filter(model => this.meetsRequirements(model, requirements));

    if (suitableModels.length === 0) {
      throw new Error('No models found that meet the requirements');
    }

    // Score and rank models
    const scoredModels = suitableModels.map(model => ({
      model: model.id,
      provider: this.findProviderForModel(model.id),
      confidence: this.calculateConfidence(model, requirements),
      estimatedCost: this.estimateModelCost(model),
      capabilities: requirements.capabilities ?? {},
      reasoning: this.generateReasoning(model, requirements),
    }));

    // Sort by confidence score
    scoredModels.sort((a: ModelSelectionResult, b: ModelSelectionResult) => b.confidence - a.confidence);

    return scoredModels[0]!;
  }

  /**
   * Estimate task cost for a given model
   */
  async estimateTask(
    prompt: string,
    modelId: string,
    options?: { estimatedInputTokens?: number; estimatedOutputTokens?: number },
  ): Promise<ModelSelectionResult> {
    await this.client.fetchModelsDevData();

    const model = this.client.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Simple estimation: assume 2 tokens per word for input, 1 per word for output
    const inputTokens = options?.estimatedInputTokens ?? prompt.split(/\s+/).length * 2;
    const outputTokens = options?.estimatedOutputTokens ?? Math.floor(prompt.split(/\s+/).length * 0.5);

    const cost = model.cost;
    const inputCost = (inputTokens / 1000) * cost.input;
    const outputCost = (outputTokens / 1000) * cost.output;

    return {
      model: modelId,
      provider: this.findProviderForModel(model.id),
      confidence: 0.8,
      estimatedCost: inputCost + outputCost,
      capabilities: {},
      reasoning: `Estimated cost based on ${inputTokens} input tokens and ${outputTokens} output tokens`,
    };
  }

  /**
   * Find the provider for a given model
   */
  private findProviderForModel(modelId: string): string {
    // Search all providers for this model
    for (const [providerId, provider] of Object.entries(this.cache ?? {})) {
      if (provider.models[modelId]) {
        return providerId;
      }
    }
    return 'unknown';
  }

  /**
   * Check if a model meets the given requirements
   */
  private meetsRequirements(model: ModelsDevModel, requirements: TaskRequirements): boolean {
    // Exclude interface/alias models
    if (model.family === 'auto') {
      return false;
    }
    
    // Exclude auto interfaces (but keep autoglm which seems to be a real model name)
    if (model.id.includes('auto') && !model.id.includes('autoglm')) {
      return false;
    }
    
    // Exclude prefix-based interface models like kilo-auto
    if (model.id.toLowerCase().startsWith('kilo-auto') || 
        model.id.toLowerCase().includes('kilo-auto/')) {
      return false;
    }

    // Check modality
    // Check modality
    if (requirements.modality) {
      const inputModalities = model.modalities?.input ?? [];
      const outputModalities = model.modalities?.output ?? [];

      if (requirements.modality === 'multimodal') {
        if (
          !inputModalities.includes('image') &&
          !inputModalities.includes('audio') &&
          !inputModalities.includes('video')
        ) {
          return false;
        }
      } else if (requirements.modality === 'code') {
        if (!inputModalities.includes('text') || !outputModalities.includes('text')) {
          return false;
        }
      }
    }

    // Check capabilities
    if (requirements.capabilities?.tool_calling && !model.tool_call) {
      return false;
    }

    // Check constraints
    if (requirements.constraints?.max_cost) {
      const cost = model.cost;
      const estimatedCost = (cost?.input ?? 0) + (cost?.output ?? 0) * 10; // rough estimate
      if (estimatedCost > requirements.constraints.max_cost) {
        return false;
      }
    }

    if (requirements.constraints?.max_context) {
      const limit = model.limit;
      if ((limit?.context ?? 0) < requirements.constraints.max_context) {
        return false;
      }
    }

    if (requirements.constraints?.exclude_family?.includes(model.family)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate confidence score for a model
   */
  private calculateConfidence(model: ModelsDevModel, requirements: TaskRequirements): number {
    let confidence = 0.5;

    // Boost confidence for models with requested features
    if (requirements.capabilities?.tool_calling && model.tool_call) {
      confidence += 0.2;
    }

    if (requirements.capabilities?.streaming) {
      // Most modern models support streaming, give slight boost
      confidence += 0.1;
    }

    // Consider specialization
    if (requirements.specialization && model.knowledge) {
      const knowledge = model.knowledge;
      if (knowledge.toLowerCase().includes(requirements.specialization.toLowerCase())) {
        confidence += 0.2;
      }
    }

    return Math.min(confidence, 1);
  }

  /**
   * Estimate model cost based on cost per thousand tokens
   */
  private estimateModelCost(model: ModelsDevModel): number {
    const cost = model.cost;
    // Rough estimate assuming 1000 input and 1000 output tokens
    return (cost?.input ?? 0) + (cost?.output ?? 0) * 10;
  }

  /**
   * Generate reasoning for model selection
   */
  private generateReasoning(model: ModelsDevModel, requirements: TaskRequirements): string {
    const reasons: string[] = [];

    if (model.tool_call && requirements.capabilities?.tool_calling) {
      reasons.push('Supports tool calling');
    }

    const limit = model.limit;
    if (limit?.context && limit.context > 200000) {
      reasons.push('Large context window');
    }

    const cost = model.cost;
    if (cost && (cost.input + cost.output) < 0.01) {
      reasons.push('Cost-effective');
    }

    return reasons.join(', ') || 'Selected based on requirements';
  }

  // Helper method to get cache for findProviderForModel
  private get cache(): ModelsDevAPI | undefined {
    return (this.client as any).cache;
  }
}