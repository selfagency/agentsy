import { describe, expect, it } from 'vitest';

import { ModelSelector, type ModelsDevAPI, ModelsDevClient } from './index.js';

function makeModelsDevData(): ModelsDevAPI {
  return {
    anthropic: {
      doc: 'https://example.test/anthropic',
      env: [],
      id: 'anthropic',
      models: {
        'claude-sonnet-4': {
          cost: { input: 3, output: 15 },
          family: 'claude-sonnet',
          id: 'claude-sonnet-4',
          last_updated: '2026-01-01',
          limit: { context: 200_000, output: 8192 },
          modalities: { input: ['text', 'image'], output: ['text'] },
          name: 'Claude Sonnet 4',
          open_weights: false,
          reasoning: true,
          release_date: '2026-01-01',
          temperature: true,
          tool_call: true
        }
      },
      name: 'Anthropic',
      npm: 'anthropic'
    },
    openai: {
      doc: 'https://example.test/openai',
      env: [],
      id: 'openai',
      models: {
        'gpt-4o-mini': {
          cost: { input: 0.15, output: 0.6 },
          family: 'gpt-4o',
          id: 'gpt-4o-mini',
          last_updated: '2026-01-01',
          limit: { context: 128_000, output: 4096 },
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
    }
  };
}

describe('ModelSelector integration', () => {
  class StubClient extends ModelsDevClient {
    private readonly data = makeModelsDevData();

    override fetchModelsDevData(): Promise<ModelsDevAPI> {
      return Promise.resolve(this.data);
    }

    override getCachedData(): ModelsDevAPI | undefined {
      return this.data;
    }

    override listModels(): ReturnType<ModelsDevClient['listModels']> {
      return Object.values(this.data).flatMap(provider => Object.values(provider.models));
    }
  }

  it('selects a reasoning-capable multimodal model deterministically', async () => {
    const client = new StubClient();
    const selector = new ModelSelector(client);

    const result = await selector.selectModel({
      capabilities: { tool_calling: true },
      modality: 'text',
      specialization: 'reasoning'
    });

    expect(result.model).toBe('claude-sonnet-4');
    expect(result.provider).toBe('anthropic');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('keeps the selected provider stable when requirements are minimal', async () => {
    const client = new StubClient();
    const selector = new ModelSelector(client);

    const first = await selector.selectModel({ modality: 'text' });
    const second = await selector.selectModel({ modality: 'text' });

    expect(first).toEqual(second);
  });
});
