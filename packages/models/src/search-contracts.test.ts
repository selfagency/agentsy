import { describe, expect, it } from 'vitest';

import {
  type ModelRefinementRequest,
  type ModelSearchQuery,
  mergeModelRefinementRequest,
  normalizeModelSearchQuery,
  type RecommendationCriteria,
  searchModels,
  selectModel,
  selectModelForProvider
} from './search-contracts.js';

describe('model search contracts', () => {
  it('normalizes model search queries', () => {
    const query: ModelSearchQuery = {
      maxPricePer1mInputUsd: 0.25,
      preferLocal: true,
      providerIds: [' openai ', 'qwen', 'openai'],
      supportsStreaming: true,
      text: '  local coding  '
    };

    expect(normalizeModelSearchQuery(query)).toEqual({
      maxPricePer1mInputUsd: 0.25,
      preferLocal: true,
      providerIds: ['openai', 'qwen'],
      supportsStreaming: true,
      text: 'local coding'
    });
  });

  it('merges refinement requests over base criteria', () => {
    const base: RecommendationCriteria = {
      budgetTier: 'mid',
      preferredLicenses: ['MIT'],
      preferLocal: false,
      task: 'coding'
    };

    const request: ModelRefinementRequest = {
      relax: ['cost'],
      task: 'reasoning',
      tighten: ['quality', 'tooling']
    };

    expect(mergeModelRefinementRequest(base, request)).toEqual({
      budgetTier: 'mid',
      preferredLicenses: ['MIT'],
      preferLocal: false,
      relax: ['cost'],
      task: 'reasoning',
      tighten: ['quality', 'tooling']
    });
  });

  it('returns model search results from normalized query text', () => {
    expect(searchModels({ text: '  local coding  ', preferLocal: true })).toEqual([
      {
        modelId: 'local coding',
        reason: 'prefer local',
        score: 0.95
      }
    ]);
  });

  it('selects a local model when local is requested', () => {
    expect(selectModel({ local: true })).toEqual({
      criteria: { local: true },
      modelId: 'gpt-4.1-mini',
      providerId: 'local'
    });
  });

  it('normalizes capabilities and prefers tool-use model ids', () => {
    expect(selectModel({ capabilities: [' tool-use ', ''] })).toEqual({
      criteria: { capabilities: ['tool-use'] },
      modelId: 'gpt-4o-mini',
      providerId: 'openai'
    });
  });

  it('selects provider-specific models from provider id', () => {
    expect(selectModelForProvider('local', { capabilities: ['tool-use'] })).toBe('gpt-4o-mini');
  });
});
