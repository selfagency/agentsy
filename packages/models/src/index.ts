import os from 'node:os';
import path from 'node:path';

import type {
  ModelsDevAPI,
  ModelsDevModel,
  ModelsDevProvider,
  ModelSelectionResult,
  TaskRequirements,
} from './types.js';

export type { ModelsDevAPI, ModelsDevModel, ModelsDevProvider, ModelSelectionResult, TaskRequirements };

// Cache structure
interface CacheData {
  timestamp: number;
  data: ModelsDevAPI;
}

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeLookupKey(key: string): boolean {
  return key.length > 0 && !FORBIDDEN_OBJECT_KEYS.has(key);
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

  getCachedData(): ModelsDevAPI | undefined {
    return this.cache;
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): ModelsDevProvider | undefined {
    if (!isSafeLookupKey(providerId)) {
      return undefined;
    }

    const cache = this.cache;
    if (!cache || !Object.hasOwn(cache, providerId)) {
      return undefined;
    }

    return cache[providerId];
  }

  /**
   * Get a specific model by ID (supports provider:model or just model format)
   */
  getModel(modelId: string): ModelsDevModel | undefined {
    // Try parsing as provider:model format
    if (modelId.includes(':')) {
      const [providerId, modelName] = modelId.split(':');
      if (providerId && modelName) {
        return this.getModelFromProvider(providerId, modelName);
      }
    }

    if (modelId.includes('/')) {
      const [providerId, modelName] = modelId.split('/');
      if (providerId && modelName) {
        return this.getModelFromProvider(providerId, modelName);
      }
    }

    // Search for model ID across all providers
    if (!isSafeLookupKey(modelId)) {
      return undefined;
    }

    for (const provider of Object.values(this.cache ?? {})) {
      if (Object.hasOwn(provider.models, modelId)) {
        return provider.models[modelId];
      }
    }
    return undefined;
  }

  private getModelFromProvider(providerId: string, modelName: string): ModelsDevModel | undefined {
    if (!isSafeLookupKey(providerId) || !isSafeLookupKey(modelName)) {
      return undefined;
    }

    const provider = this.getProvider(providerId);
    if (!provider || !Object.hasOwn(provider.models, modelName)) {
      return undefined;
    }

    return provider.models[modelName];
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

    // Only use models from unique model-originated providers (not routing platforms)
    const uniqueModelProviders = new Set([
      'anthropic',
      'google',
      'google-vertex',
      'google-vertex-anthropic',
      'openai',
      'moonshotai',
      'meta',
      'mistral',
      'cohere',
      'deepseek',
      'perplexity',
      'groq',
      'xai',
      'microsoft',
      'nvidia',
      'aws',
      'azure',
      'openai-compatible',
      'azure',
      'meta_llama',
      'deepseek-r1',
      'qwen',
      'modelscope',
      'vllm',
      'lm-studio',
      'together-ai',
      'scaleway',
      'abacus',
      'deepseek',
      'perplexity-ai',
      'nebula',
      'novita-ai',
    ]);

    const originalProviderModels = allModels.filter(model => {
      const provider = this.findProviderForModel(model.id);
      return provider && uniqueModelProviders.has(provider);
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

    const bestModel = scoredModels[0];
    if (!bestModel) {
      throw new Error('No model could be ranked after filtering');
    }

    return bestModel;
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
    if (this.isInterfaceModel(model)) {
      return false;
    }

    if (!this.matchesModalityRequirements(model, requirements.modality)) {
      return false;
    }

    if (!this.matchesCapabilityRequirements(model, requirements)) {
      return false;
    }

    if (!this.matchesConstraints(model, requirements.constraints)) {
      return false;
    }

    return true;
  }

  private isInterfaceModel(model: ModelsDevModel): boolean {
    if (model.family === 'auto') {
      return true;
    }

    if (model.id.includes('auto') && !model.id.includes('autoglm')) {
      return true;
    }

    const modelIdLower = model.id.toLowerCase();
    return modelIdLower.startsWith('kilo-auto') || modelIdLower.includes('kilo-auto/');
  }

  private matchesModalityRequirements(model: ModelsDevModel, modality?: TaskRequirements['modality']): boolean {
    if (!modality) {
      return true;
    }

    const inputModalities = model.modalities?.input ?? [];
    const outputModalities = model.modalities?.output ?? [];

    if (modality === 'multimodal') {
      return (
        inputModalities.includes('image') || inputModalities.includes('audio') || inputModalities.includes('video')
      );
    }

    if (modality === 'code') {
      return inputModalities.includes('text') && outputModalities.includes('text');
    }

    return true;
  }

  private matchesCapabilityRequirements(model: ModelsDevModel, requirements: TaskRequirements): boolean {
    if (requirements.capabilities?.tool_calling && !model.tool_call) {
      return false;
    }

    return true;
  }

  private matchesConstraints(model: ModelsDevModel, constraints?: TaskRequirements['constraints']): boolean {
    if (!constraints) {
      return true;
    }

    if (constraints.max_cost !== undefined) {
      const estimatedCost = this.estimateModelCost(model);
      if (estimatedCost > constraints.max_cost) {
        return false;
      }
    }

    if (constraints.max_context !== undefined) {
      const maxContext = model.limit?.context ?? 0;
      if (maxContext < constraints.max_context) {
        return false;
      }
    }

    if (constraints.exclude_family?.includes(model.family)) {
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
    if (cost && cost.input + cost.output < 0.01) {
      reasons.push('Cost-effective');
    }

    return reasons.join(', ') || 'Selected based on requirements';
  }

  // Helper method to get cache for findProviderForModel
  private get cache(): ModelsDevAPI | undefined {
    return this.client.getCachedData();
  }
}
