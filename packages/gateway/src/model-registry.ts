/**
 * Static model registry for the gateway. Provides known models
 * with tier, cost, and capability metadata. Tiers are defined on
 * models (ModelEntry.tier), not on providers.
 *
 * The registry is populated from a static configuration covering
 * the most common provider/model combinations. In a production
 * deployment this could be extended with dynamic discovery or
 * a configuration file.
 */

import type { ModelCost, ModelEntry, ModelTier, UseCase } from './types.js';

const COSTS = {
  openaiMini: { inputPer1MTokens: 0.15, outputPer1MTokens: 0.6 },
  openai4o: { inputPer1MTokens: 2.5, outputPer1MTokens: 10 },
  openaiO1Mini: { inputPer1MTokens: 3, outputPer1MTokens: 12 },
  anthropicHaiku: { inputPer1MTokens: 0.8, outputPer1MTokens: 4, cachedInputPer1MTokens: 0.08 },
  anthropicSonnet: { inputPer1MTokens: 3, outputPer1MTokens: 15, cachedInputPer1MTokens: 0.3 },
  anthropicOpus: { inputPer1MTokens: 15, outputPer1MTokens: 75, cachedInputPer1MTokens: 1.5 },
  localFree: { inputPer1MTokens: 0, outputPer1MTokens: 0 }
} as const satisfies Record<string, ModelCost>;

const MODELS: ModelEntry[] = [
  // OpenAI
  {
    id: 'openai/gpt-4o-mini',
    providerId: 'openai',
    modelName: 'gpt-4o-mini',
    tier: 'small',
    useCases: ['chat', 'code'],
    cost: COSTS.openaiMini,
    capabilities: { tools: true, jsonMode: true, vision: false, audio: false, reasoning: false, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 16_384
  },
  {
    id: 'openai/gpt-4o',
    providerId: 'openai',
    modelName: 'gpt-4o',
    tier: 'mid',
    useCases: ['chat', 'code', 'vision'],
    cost: COSTS.openai4o,
    capabilities: { tools: true, jsonMode: true, vision: true, audio: false, reasoning: false, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 16_384
  },
  {
    id: 'openai/o1-mini',
    providerId: 'openai',
    modelName: 'o1-mini',
    tier: 'frontier',
    useCases: ['code', 'reasoning'],
    cost: COSTS.openaiO1Mini,
    capabilities: { tools: true, jsonMode: false, vision: false, audio: false, reasoning: true, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 65_536
  },

  // Anthropic
  {
    id: 'anthropic/claude-3-5-haiku',
    providerId: 'anthropic',
    modelName: 'claude-3-5-haiku-20241022',
    tier: 'small',
    useCases: ['chat'],
    cost: COSTS.anthropicHaiku,
    capabilities: { tools: true, jsonMode: true, vision: true, audio: false, reasoning: false, embeddings: false },
    contextWindow: 200_000,
    maxOutputTokens: 8192
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    providerId: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022',
    tier: 'mid',
    useCases: ['chat', 'code', 'vision'],
    cost: COSTS.anthropicSonnet,
    capabilities: { tools: true, jsonMode: true, vision: true, audio: false, reasoning: false, embeddings: false },
    contextWindow: 200_000,
    maxOutputTokens: 8192
  },
  {
    id: 'anthropic/claude-3-5-opus',
    providerId: 'anthropic',
    modelName: 'claude-3-5-opus-20241022',
    tier: 'frontier',
    useCases: ['chat', 'code', 'vision', 'reasoning'],
    cost: COSTS.anthropicOpus,
    capabilities: { tools: true, jsonMode: true, vision: true, audio: false, reasoning: true, embeddings: false },
    contextWindow: 200_000,
    maxOutputTokens: 8192
  },

  // Ollama (local, free)
  {
    id: 'ollama/llama3.2:1b',
    providerId: 'ollama',
    modelName: 'llama3.2:1b',
    tier: 'micro',
    useCases: ['chat'],
    cost: COSTS.localFree,
    capabilities: { tools: false, jsonMode: false, vision: false, audio: false, reasoning: false, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    isLocal: true
  },
  {
    id: 'ollama/llama3.3:70b',
    providerId: 'ollama',
    modelName: 'llama3.3:70b',
    tier: 'mid',
    useCases: ['chat', 'code'],
    cost: COSTS.localFree,
    capabilities: { tools: true, jsonMode: true, vision: false, audio: false, reasoning: false, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    isLocal: true
  },
  {
    id: 'ollama/qwen3-coder',
    providerId: 'ollama',
    modelName: 'qwen3-coder:latest',
    tier: 'mid',
    useCases: ['code'],
    cost: COSTS.localFree,
    capabilities: { tools: true, jsonMode: true, vision: false, audio: false, reasoning: false, embeddings: false },
    contextWindow: 32_000,
    maxOutputTokens: 8192,
    isLocal: true
  }
];

export class ModelRegistry {
  readonly #models: Map<string, ModelEntry> = new Map();
  readonly #byTier: Map<ModelTier, ModelEntry[]> = new Map();
  readonly #byUseCase: Map<UseCase, ModelEntry[]> = new Map();
  readonly #byTierAndUseCase: Map<string, ModelEntry[]> = new Map();

  constructor(entries: ModelEntry[] = MODELS) {
    for (const model of entries) {
      this.#models.set(model.id, model);

      // Index by tier
      const tierList = this.#byTier.get(model.tier);
      if (tierList === undefined) {
        this.#byTier.set(model.tier, [model]);
      } else {
        tierList.push(model);
      }

      // Index by use case and composite tier:useCase
      for (const useCase of model.useCases) {
        const ucList = this.#byUseCase.get(useCase);
        if (ucList === undefined) {
          this.#byUseCase.set(useCase, [model]);
        } else {
          ucList.push(model);
        }

        const compositeKey = `${model.tier}:${useCase}`;
        const tcList = this.#byTierAndUseCase.get(compositeKey);
        if (tcList === undefined) {
          this.#byTierAndUseCase.set(compositeKey, [model]);
        } else {
          tcList.push(model);
        }
      }
    }
  }

  getAllModels(): ModelEntry[] {
    return [...this.#models.values()];
  }

  getModelById(id: string): ModelEntry | undefined {
    return this.#models.get(id);
  }

  getModelsByTier(tier: ModelTier): ModelEntry[] {
    return this.#byTier.get(tier) ?? [];
  }

  /** Get all models that support a given use case. */
  getModelsByUseCase(useCase: UseCase): ModelEntry[] {
    return this.#byUseCase.get(useCase) ?? [];
  }

  /** Get all models matching both a tier and a use case. */
  getModelsByTierAndUseCase(tier: ModelTier, useCase: UseCase): ModelEntry[] {
    return this.#byTierAndUseCase.get(`${tier}:${useCase}`) ?? [];
  }
}

export const modelRegistry = new ModelRegistry();
