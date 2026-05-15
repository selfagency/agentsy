import { describe, expect, it } from 'vitest';

import {
  recommendLocalModelsBySystemCapabilities,
  type LLMStatsLocalModel,
  type ModelsDevAPI,
  type SystemCapabilities,
} from './index.js';

const modelsDevFixture: ModelsDevAPI = {
  openai: {
    id: 'openai',
    env: [],
    npm: 'openai',
    name: 'OpenAI',
    doc: 'https://example.com/openai',
    models: {
      'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        family: 'gpt-4o',
        reasoning: true,
        tool_call: true,
        temperature: true,
        knowledge: 'general coding',
        release_date: '2026-01-01',
        last_updated: '2026-01-01',
        modalities: { input: ['text'], output: ['text'] },
        open_weights: false,
        limit: { context: 128000, output: 8192 },
        cost: { input: 0.3, output: 0.6 },
      },
    },
  },
  qwen: {
    id: 'qwen',
    env: [],
    npm: '@qwen/sdk',
    name: 'Qwen',
    doc: 'https://example.com/qwen',
    models: {
      'qwen2.5-coder-7b': {
        id: 'qwen2.5-coder-7b',
        name: 'Qwen2.5 Coder 7B',
        family: 'qwen',
        reasoning: true,
        tool_call: true,
        temperature: true,
        knowledge: 'coding',
        release_date: '2026-01-01',
        last_updated: '2026-01-01',
        modalities: { input: ['text'], output: ['text'] },
        open_weights: true,
        limit: { context: 131072, output: 8192 },
        cost: { input: 0.05, output: 0.1 },
      },
      'qwen2.5-coder-32b': {
        id: 'qwen2.5-coder-32b',
        name: 'Qwen2.5 Coder 32B',
        family: 'qwen',
        reasoning: true,
        tool_call: true,
        temperature: true,
        knowledge: 'coding',
        release_date: '2026-01-01',
        last_updated: '2026-01-01',
        modalities: { input: ['text'], output: ['text'] },
        open_weights: true,
        limit: { context: 262144, output: 8192 },
        cost: { input: 0.2, output: 0.4 },
      },
    },
  },
};

const llmStatsFixture: LLMStatsLocalModel[] = [
  {
    modelId: 'qwen2.5-coder-7b',
    categoryScores: { coding: 86, general: 80 },
    minRamGb: 12,
    minVramGb: 8,
    estimatedTokensPerSecond: 44,
    runtime: 'llama.cpp',
    quantization: 'q4_k_m',
    isLocalCompatible: true,
  },
  {
    modelId: 'qwen2.5-coder-32b',
    categoryScores: { coding: 95, general: 90 },
    minRamGb: 48,
    minVramGb: 24,
    estimatedTokensPerSecond: 18,
    runtime: 'llama.cpp',
    quantization: 'q4_k_m',
    isLocalCompatible: true,
  },
  {
    modelId: 'gpt-4o-mini',
    categoryScores: { coding: 78, general: 84 },
    minRamGb: 4,
    minVramGb: 0,
    estimatedTokensPerSecond: 60,
    runtime: 'ollama',
    quantization: 'q8_0',
    isLocalCompatible: true,
  },
];

const systemCapabilities: SystemCapabilities = {
  ramGb: 32,
  vramGb: 12,
  cpuCores: 8,
  backend: 'cuda',
};

describe('recommendLocalModelsBySystemCapabilities', () => {
  it('filters out models that do not fit system memory limits', () => {
    const recommendations = recommendLocalModelsBySystemCapabilities(
      modelsDevFixture,
      llmStatsFixture,
      systemCapabilities,
      { taskCategory: 'coding' },
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
      { taskCategory: 'coding' },
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
      { taskCategory: 'coding', preferLowCost: true, topN: 1 },
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.estimatedCost ?? 0).toBeLessThanOrEqual(0.151);
  });

  it('enforces tool-calling requirement', () => {
    const noToolModelData: ModelsDevAPI = {
      ...modelsDevFixture,
      qwen: {
        ...modelsDevFixture.qwen,
        models: {
          ...modelsDevFixture.qwen.models,
          'qwen2.5-coder-7b': {
            ...modelsDevFixture.qwen.models['qwen2.5-coder-7b'],
            tool_call: false,
          },
        },
      },
    };

    const recommendations = recommendLocalModelsBySystemCapabilities(
      noToolModelData,
      llmStatsFixture,
      systemCapabilities,
      { taskCategory: 'coding', requireToolCalling: true },
    );

    const ids = recommendations.map(entry => entry.model);
    expect(ids).not.toContain('qwen2.5-coder-7b');
  });
});
