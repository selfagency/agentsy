import { describe, expect, it } from 'vitest';
import type { LLMStatsLocalModel, ModelsDevAPI, SystemCapabilities } from './index.js';
import { recommendLocalModelsBySystemCapabilities } from './index.js';

const modelsDevFixture: ModelsDevAPI = {
  openai: {
    doc: 'https://example.com/openai',
    env: [],
    id: 'openai',
    models: {
      'gpt-4o-mini': {
        cost: { input: 0.3, output: 0.6 },
        family: 'gpt-4o',
        id: 'gpt-4o-mini',
        knowledge: 'general coding',
        last_updated: '2026-01-01',
        limit: { context: 128_000, output: 8192 },
        modalities: { input: ['text'], output: ['text'] },
        name: 'GPT-4o mini',
        open_weights: false,
        reasoning: true,
        release_date: '2026-01-01',
        temperature: true,
        tool_call: true
      }
    },
    name: 'OpenAI',
    npm: 'openai'
  },
  qwen: {
    doc: 'https://example.com/qwen',
    env: [],
    id: 'qwen',
    models: {
      'qwen2.5-coder-32b': {
        cost: { input: 0.2, output: 0.4 },
        family: 'qwen',
        id: 'qwen2.5-coder-32b',
        knowledge: 'coding',
        last_updated: '2026-01-01',
        limit: { context: 262_144, output: 8192 },
        modalities: { input: ['text'], output: ['text'] },
        name: 'Qwen2.5 Coder 32B',
        open_weights: true,
        reasoning: true,
        release_date: '2026-01-01',
        temperature: true,
        tool_call: true
      },
      'qwen2.5-coder-7b': {
        cost: { input: 0.05, output: 0.1 },
        family: 'qwen',
        id: 'qwen2.5-coder-7b',
        knowledge: 'coding',
        last_updated: '2026-01-01',
        limit: { context: 131_072, output: 8192 },
        modalities: { input: ['text'], output: ['text'] },
        name: 'Qwen2.5 Coder 7B',
        open_weights: true,
        reasoning: true,
        release_date: '2026-01-01',
        temperature: true,
        tool_call: true
      }
    },
    name: 'Qwen',
    npm: '@qwen/sdk'
  }
};

const llmStatsFixture: LLMStatsLocalModel[] = [
  {
    categoryScores: { coding: 86, general: 80 },
    estimatedTokensPerSecond: 44,
    isLocalCompatible: true,
    minRamGb: 12,
    minVramGb: 8,
    modelId: 'qwen2.5-coder-7b',
    quantization: 'q4_k_m',
    runtime: 'llama.cpp'
  },
  {
    categoryScores: { coding: 95, general: 90 },
    estimatedTokensPerSecond: 18,
    isLocalCompatible: true,
    minRamGb: 48,
    minVramGb: 24,
    modelId: 'qwen2.5-coder-32b',
    quantization: 'q4_k_m',
    runtime: 'llama.cpp'
  },
  {
    categoryScores: { coding: 78, general: 84 },
    estimatedTokensPerSecond: 60,
    isLocalCompatible: true,
    minRamGb: 4,
    minVramGb: 0,
    modelId: 'gpt-4o-mini',
    quantization: 'q8_0',
    runtime: 'ollama'
  }
];

const systemCapabilities: SystemCapabilities = {
  backend: 'cuda',
  cpuCores: 8,
  ramGb: 32,
  vramGb: 12
};

describe('recommendLocalModelsBySystemCapabilities', () => {
  it('filters out models that do not fit system memory limits', () => {
    const recommendations = recommendLocalModelsBySystemCapabilities(
      modelsDevFixture,
      llmStatsFixture,
      systemCapabilities,
      { taskCategory: 'coding' }
    );

    const ids = recommendations.map(entry => entry.model);
    expect(ids).toContain('qwen2.5-coder-7b');
    expect(ids).not.toContain('qwen2.5-coder-32b');
  });

  it('returns recommendations sorted by composite score', () => {
    const recommendations = recommendLocalModelsBySystemCapabilities(
      modelsDevFixture,
      llmStatsFixture,
      systemCapabilities,
      { taskCategory: 'coding' }
    );

    expect(recommendations.length).toBeGreaterThan(0);
    for (let i = 0; i < recommendations.length - 1; i += 1) {
      const current = recommendations[i];
      const next = recommendations[i + 1];
      expect(current?.compositeScore ?? 0).toBeGreaterThanOrEqual(next?.compositeScore ?? 0);
    }
  });

  it('supports low-cost preference and topN limiting', () => {
    const recommendations = recommendLocalModelsBySystemCapabilities(
      modelsDevFixture,
      llmStatsFixture,
      systemCapabilities,
      { preferLowCost: true, taskCategory: 'coding', topN: 1 }
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.estimatedCost ?? 0).toBeLessThanOrEqual(0.151);
  });

  it('enforces tool-calling requirement', () => {
    const qwenProvider = modelsDevFixture.qwen;
    if (!qwenProvider) {
      throw new Error('Expected qwen provider in fixture');
    }
    const qwen7bModel = qwenProvider.models['qwen2.5-coder-7b'];
    if (!qwen7bModel) {
      throw new Error('Expected qwen2.5-coder-7b model in fixture');
    }

    const noToolModelData: ModelsDevAPI = {
      ...modelsDevFixture,
      qwen: {
        ...qwenProvider,
        models: {
          ...qwenProvider.models,
          'qwen2.5-coder-7b': {
            ...qwen7bModel,
            tool_call: false
          }
        }
      }
    };

    const recommendations = recommendLocalModelsBySystemCapabilities(
      noToolModelData,
      llmStatsFixture,
      systemCapabilities,
      { requireToolCalling: true, taskCategory: 'coding' }
    );

    const ids = recommendations.map(entry => entry.model);
    expect(ids).not.toContain('qwen2.5-coder-7b');
  });
});
