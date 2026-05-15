import os from 'node:os';
import path from 'node:path';

import type {
  LLMStatsLocalModel,
  LocalModelRecommendation,
  LocalRecommendationCriteria,
  ModelsDevAPI,
  ModelsDevModel,
  ModelsDevProvider,
  ModelSelectionResult,
  SystemCapabilities,
  TaskRequirements
} from './types.js';

export type {
  LLMStatsLocalModel,
  LocalModelRecommendation,
  LocalRecommendationCriteria,
  ModelsDevAPI,
  ModelsDevModel,
  ModelsDevProvider,
  ModelSelectionResult,
  SystemCapabilities,
  TaskRequirements
};

// Cache structure
interface CacheData {
  timestamp: number;
  data: ModelsDevAPI;
}

const PARAMS_B_PATTERN = /(\d+(?:\.\d+)?)\s*b\b/i;

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeLookupKey(key: string): boolean {
  return key.length > 0 && !FORBIDDEN_OBJECT_KEYS.has(key);
}

function normalizeModelId(id: string): string {
  return id.trim().toLowerCase().replace('/', ':');
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function parseParamsBillionsFromId(modelId: string): number | undefined {
  const match = PARAMS_B_PATTERN.exec(modelId);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function quantizationFactor(quantization?: string): number {
  if (!quantization) {
    return 0.5;
  }

  const q = quantization.toLowerCase();

  if (q.includes('q2')) return 0.2;
  if (q.includes('q3')) return 0.28;
  if (q.includes('q4')) return 0.36;
  if (q.includes('q5')) return 0.45;
  if (q.includes('q6')) return 0.56;
  if (q.includes('q8')) return 0.7;
  if (q.includes('f16')) return 1;

  return 0.5;
}

function estimateMemoryRequirementsFromModelId(
  modelId: string,
  quantization?: string
): {
  requiredRamGb: number;
  requiredVramGb: number;
} {
  const paramsB = parseParamsBillionsFromId(modelId) ?? 7;
  const fp16Gb = paramsB * 2;
  const quantizedGb = fp16Gb * quantizationFactor(quantization);
  const requiredVramGb = Math.max(1, quantizedGb);
  const requiredRamGb = Math.max(2, requiredVramGb * 1.3);

  return { requiredRamGb, requiredVramGb };
}

function resolveModelsDevModel(
  modelsDevData: ModelsDevAPI,
  modelId: string
): { provider: string; model: ModelsDevModel } | undefined {
  const normalizedTarget = normalizeModelId(modelId);

  for (const [providerId, provider] of Object.entries(modelsDevData)) {
    for (const [modelKey, model] of Object.entries(provider.models)) {
      const normalizedModelKey = normalizeModelId(modelKey);
      const normalizedModelId = normalizeModelId(model.id);
      const normalizedProviderModel = normalizeModelId(`${providerId}:${modelKey}`);

      const candidateIds = [normalizedModelId, normalizedModelKey, normalizedProviderModel];
      if (candidateIds.includes(normalizedTarget)) {
        return { provider: providerId, model };
      }
    }
  }

  return undefined;
}

function getCategoryBenchmarkScore(
  entry: LLMStatsLocalModel,
  category: NonNullable<LocalRecommendationCriteria['taskCategory']>
): number {
  const categoryValue = entry.categoryScores?.[category];
  if (typeof categoryValue === 'number') {
    return clamp01(categoryValue / 100);
  }

  if (typeof entry.rankingScore === 'number') {
    return clamp01(entry.rankingScore / 100);
  }

  return 0.5;
}

function getAvailableVram(systemCapabilities: SystemCapabilities): number {
  if (systemCapabilities.unifiedMemory) {
    return systemCapabilities.ramGb;
  }

  return systemCapabilities.vramGb ?? 0;
}

interface RecommendationInputs {
  entry: LLMStatsLocalModel;
  criteria: LocalRecommendationCriteria;
  category: NonNullable<LocalRecommendationCriteria['taskCategory']>;
  modelsDevData: ModelsDevAPI;
  systemCapabilities: SystemCapabilities;
  availableVram: number;
}

function isEligibleForCriteria(model: ModelsDevModel, criteria: LocalRecommendationCriteria): boolean {
  if (criteria.requireToolCalling && !model.tool_call) {
    return false;
  }
  if (criteria.minContext !== undefined && model.limit.context < criteria.minContext) {
    return false;
  }
  return true;
}

function buildRecommendation(inputs: RecommendationInputs): LocalModelRecommendation | null {
  const { entry, criteria, category, modelsDevData, systemCapabilities, availableVram } = inputs;

  if (entry.isLocalCompatible === false) {
    return null;
  }

  const resolved = resolveModelsDevModel(modelsDevData, entry.modelId);
  const model = resolved?.model;
  const provider = resolved?.provider ?? 'unknown';

  if (!model) {
    return null;
  }

  if (!isEligibleForCriteria(model, criteria)) {
    return null;
  }

  const { requiredRamGb, requiredVramGb } = getMemoryRequirements(entry);
  const ramFits = requiredRamGb <= systemCapabilities.ramGb;
  const vramFits = requiredVramGb <= availableVram || availableVram === 0;

  if (!ramFits || !vramFits) {
    return null;
  }

  const ramUtilization = requiredRamGb / Math.max(systemCapabilities.ramGb, 0.1);
  const vramUtilization = requiredVramGb / Math.max(availableVram || requiredVramGb || 1, 0.1);
  const utilization = Math.max(ramUtilization, vramUtilization);

  const fitScore = clamp01(1 - Math.abs(utilization - 0.65));
  const benchmarkScore = getCategoryBenchmarkScore(entry, category);
  const speedScore = clamp01((entry.estimatedTokensPerSecond ?? 20) / 100);

  const rawCost = (model.cost.input ?? 0) + (model.cost.output ?? 0);
  const costScore = clamp01(1 / (1 + rawCost * 50));

  const contextScore = clamp01(model.limit.context / 256000);
  const capabilityScore = criteria.requireToolCalling ? (model.tool_call ? 1 : 0) : 0.8;

  const fitWeight = 0.4;
  const benchmarkWeight = 0.3;
  const capabilityWeight = 0.1;
  const contextWeight = 0.1;
  const speedWeight = 0.05;
  const costWeight = criteria.preferLowCost ? 0.15 : 0.05;

  const compositeScore =
    fitWeight * fitScore +
    benchmarkWeight * benchmarkScore +
    capabilityWeight * capabilityScore +
    contextWeight * contextScore +
    speedWeight * speedScore +
    costWeight * costScore;

  const recommendation: LocalModelRecommendation = {
    model: model.id,
    provider,
    confidence: clamp01(compositeScore),
    estimatedCost: rawCost,
    capabilities: {
      tool_calling: model.tool_call,
      reasoning: model.reasoning
    },
    reasoning: `Fit ${fitScore.toFixed(2)}, benchmark ${benchmarkScore.toFixed(2)}, cost ${costScore.toFixed(2)} for ${category}`,
    fitScore,
    benchmarkScore,
    speedScore,
    costScore,
    compositeScore,
    requiredRamGb,
    requiredVramGb
  };

  if (entry.runtime !== undefined) {
    recommendation.runtime = entry.runtime;
  }

  if (entry.quantization !== undefined) {
    recommendation.quantization = entry.quantization;
  }

  return recommendation;
}

function getMemoryRequirements(entry: LLMStatsLocalModel): { requiredRamGb: number; requiredVramGb: number } {
  if (entry.minRamGb !== undefined || entry.minVramGb !== undefined) {
    return {
      requiredRamGb: entry.minRamGb ?? entry.recommendedRamGb ?? 0,
      requiredVramGb: entry.minVramGb ?? entry.recommendedVramGb ?? 0
    };
  }

  return estimateMemoryRequirementsFromModelId(entry.modelId, entry.quantization);
}

/**
 * Recommend local models by combining models.dev metadata, llm-stats/local benchmark data,
 * and system capability constraints.
 */
export function recommendLocalModelsBySystemCapabilities(
  modelsDevData: ModelsDevAPI,
  llmStatsLocalModels: LLMStatsLocalModel[],
  systemCapabilities: SystemCapabilities,
  criteria: LocalRecommendationCriteria = {}
): LocalModelRecommendation[] {
  const category = criteria.taskCategory ?? 'general';
  const availableVram = getAvailableVram(systemCapabilities);

  const recommendations: LocalModelRecommendation[] = [];

  for (const entry of llmStatsLocalModels) {
    const recommendation = buildRecommendation({
      entry,
      criteria,
      category,
      modelsDevData,
      systemCapabilities,
      availableVram
    });

    if (recommendation) {
      recommendations.push(recommendation);
    }
  }

  recommendations.sort((a, b) => b.compositeScore - a.compositeScore);

  if (criteria.topN !== undefined) {
    return recommendations.slice(0, Math.max(0, criteria.topN));
  }

  return recommendations;
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

    const suitableModels = this.getModelsMatchingRequirements(requirements);
    const scoredModels = this.scoreModels(suitableModels, requirements);
    return this.pickBestModel(scoredModels);
  }

  /**
   * Local recommendation entrypoint using cached models.dev + provided llm-stats/local signals.
   */
  async recommendLocalModels(
    llmStatsLocalModels: LLMStatsLocalModel[],
    systemCapabilities: SystemCapabilities,
    criteria: LocalRecommendationCriteria = {}
  ): Promise<LocalModelRecommendation[]> {
    const data = await this.client.fetchModelsDevData();
    return recommendLocalModelsBySystemCapabilities(data, llmStatsLocalModels, systemCapabilities, criteria);
  }

  private getModelsMatchingRequirements(requirements: TaskRequirements): ModelsDevModel[] {
    const allModels = this.client.listModels();
    const providerModels = this.filterUniqueProviderModels(allModels);
    return providerModels.filter(model => this.meetsRequirements(model, requirements));
  }

  private filterUniqueProviderModels(allModels: ModelsDevModel[]): ModelsDevModel[] {
    const uniqueModelProviders = this.getUniqueProviderSet();
    return allModels.filter(model => {
      const provider = this.findProviderForModel(model.id);
      return provider && uniqueModelProviders.has(provider);
    });
  }

  private getUniqueProviderSet(): Set<string> {
    return new Set([
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
      'groq',
      'xai',
      'microsoft',
      'nvidia',
      'aws',
      'azure',
      'openai-compatible',
      'meta_llama',
      'deepseek-r1',
      'qwen',
      'modelscope',
      'vllm',
      'lm-studio',
      'together-ai',
      'scaleway',
      'abacus',
      'perplexity-ai',
      'nebula',
      'novita-ai'
    ]);
  }

  private scoreModels(models: ModelsDevModel[], requirements: TaskRequirements): ModelSelectionResult[] {
    return models.map(model => ({
      model: model.id,
      provider: this.findProviderForModel(model.id),
      confidence: this.calculateConfidence(model, requirements),
      estimatedCost: this.estimateModelCost(model),
      capabilities: requirements.capabilities ?? {},
      reasoning: this.generateReasoning(model, requirements)
    }));
  }

  private pickBestModel(scoredModels: ModelSelectionResult[]): ModelSelectionResult {
    if (scoredModels.length === 0) {
      throw new Error('No models found that meet the requirements');
    }

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
    options?: { estimatedInputTokens?: number; estimatedOutputTokens?: number }
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
      reasoning: `Estimated cost based on ${inputTokens} input tokens and ${outputTokens} output tokens`
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
