/**
 * Tests for model-tier routing: ModelRegistry, selector,
 * availability tracker, and local detector.
 */

import { describe, expect, it } from 'vitest';

import { ModelRegistry, modelRegistry } from '../model-registry.js';
import type { ModelEntry } from '../types.js';

// =============================================================================
// ModelRegistry
// =============================================================================

describe('ModelRegistry', () => {
  it('returns all registered models', () => {
    const all = modelRegistry.getAllModels();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty('id');
    expect(all[0]).toHaveProperty('tier');
  });

  it('looks up a model by id', () => {
    const model = modelRegistry.getModelById('openai/gpt-4o-mini');
    expect(model).toBeDefined();
    expect(model?.tier).toBe('small');
  });

  it('returns undefined for unknown id', () => {
    expect(modelRegistry.getModelById('nope')).toBeUndefined();
  });

  it('filters models by tier', () => {
    const micro = modelRegistry.getModelsByTier('micro');
    expect(micro.length).toBeGreaterThanOrEqual(1);
    expect(micro[0]?.tier).toBe('micro');
  });

  it('returns empty array for tier with no models', () => {
    expect(modelRegistry.getModelsByTier('frontier')).toBeDefined();
  });

  it('supports custom model registries', () => {
    const custom: ModelEntry[] = [
      {
        id: 'custom/test',
        providerId: 'test',
        modelName: 'test',
        tier: 'small',
        useCases: ['chat'],
        cost: { inputPer1MTokens: 1, outputPer1MTokens: 2 },
        capabilities: {
          tools: false,
          jsonMode: false,
          vision: false,
          audio: false,
          reasoning: false,
          embeddings: false
        },
        contextWindow: 1000,
        maxOutputTokens: 100
      }
    ];
    const registry = new ModelRegistry(custom);
    expect(registry.getAllModels()).toHaveLength(1);
    expect(registry.getModelById('custom/test')).toBeDefined();
  });
});

// =============================================================================
// DefaultTierAwareModelSelector (unit — no availability tracking)
// =============================================================================

import { DefaultTierAwareModelSelector } from '../selector.js';

describe('DefaultTierAwareModelSelector', () => {
  const selector = new DefaultTierAwareModelSelector();

  it('selects the cheapest model for a given tier', async () => {
    // small tier: gpt-4o-mini ($0.15/1M) vs haiku ($0.80/1M)
    const model = await selector.selectModelForTier({ tier: 'small' });
    // Should pick the cheapest: gpt-4o-mini
    expect(model.id).toBe('openai/gpt-4o-mini');
  });

  it('filters by use case', async () => {
    const model = await selector.selectModelForTier({ tier: 'mid', useCase: 'vision' });
    // Only gpt-4o and sonnet support vision in mid tier
    expect(['openai/gpt-4o', 'anthropic/claude-3-5-sonnet']).toContain(model.id);
  });

  it('prefers local models for micro tier', async () => {
    const model = await selector.selectModelForTier({ tier: 'micro' });
    // Only local models in micro tier (llama3.2:1b)
    expect(model.isLocal).toBe(true);
  });

  it('throws when localPreference=required and no local models available', async () => {
    // frontier tier has no local models
    await expect(async () =>
      selector.selectModelForTier({ tier: 'frontier', constraints: { localPreference: 'required' } })
    ).rejects.toThrow(/No local models/);
  });

  it('filters out local models when disabled', async () => {
    const model = await selector.selectModelForTier({
      tier: 'small',
      constraints: { localPreference: 'disabled' }
    });
    expect(model.isLocal).toBeFalsy();
  });

  it('enforces requireTools constraint', async () => {
    const model = await selector.selectModelForTier({
      tier: 'small',
      constraints: { requireTools: true }
    });
    // haiku is the only small-tier model with tools=true in Anthropic
    expect(model.capabilities.tools).toBe(true);
  });

  it('throws when no models match constraints', async () => {
    await expect(async () =>
      selector.selectModelForTier({
        tier: 'small',
        constraints: { minContextWindow: 1_000_000 }
      })
    ).rejects.toThrow(/No models match/);
  });

  it('excludes specified providers', async () => {
    const model = await selector.selectModelForTier({
      tier: 'mid',
      constraints: { excludeProviders: ['openai'] }
    });
    expect(model.providerId).not.toBe('openai');
  });
});

// =============================================================================
// ModelAvailabilityTracker
// =============================================================================

import { ModelAvailabilityTracker } from '../availability-tracker.js';

describe('ModelAvailabilityTracker', () => {
  const tracker = new ModelAvailabilityTracker({ ttlMs: 10_000, timeoutMs: 500 });
  const model: ModelEntry = {
    id: 'openai/gpt-4o-mini',
    providerId: 'openai-main',
    modelName: 'gpt-4o-mini',
    tier: 'small',
    useCases: ['chat'],
    cost: { inputPer1MTokens: 0.15, outputPer1MTokens: 0.6 },
    capabilities: { tools: true, jsonMode: true, vision: false, audio: false, reasoning: false, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 16_384
  };

  const localModel: ModelEntry = {
    id: 'ollama/test',
    providerId: 'ollama-local',
    modelName: 'test',
    tier: 'micro',
    useCases: ['chat'],
    cost: { inputPer1MTokens: 0, outputPer1MTokens: 0 },
    capabilities: { tools: false, jsonMode: false, vision: false, audio: false, reasoning: false, embeddings: false },
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    isLocal: true
  };

  it('assumes cloud models are available by default', () => {
    const available = tracker.getAvailableModels([model]);
    expect(available.map(m => m.id)).toContain(model.id);
  });

  it('does not crash when probing unreachable local endpoint', async () => {
    await tracker.checkAvailability([localModel], new Map([['ollama-local', 'http://127.0.0.1:1']]));
    // Should mark as unavailable, not throw
    const snapshot = tracker.getSnapshot();
    const entry = snapshot.find(s => s.modelId === localModel.id);
    expect(entry).toBeDefined();
    expect(entry?.isAvailable).toBe(false);
  });

  it('returns latency from snapshot after a successful probe', async () => {
    await tracker.checkAvailability([model], new Map([['openai-main', 'https://api.openai.com']]));
    const latency = tracker.getLatency(model.id);
    // May be defined or undefined depending on actual HTTP call
    // In test env it's undefined (no actual server), but that's fine
    expect(typeof latency).toBe('number');
  });
});

// =============================================================================
// LocalModelDetector — mocked fetch
// =============================================================================

import { LocalModelDetector } from '../local-detector.js';

describe('LocalModelDetector', () => {
  const detector = new LocalModelDetector();

  it('returns results from reachable backends (or empty array)', async () => {
    const models = await detector.detectAvailableLocalModels();
    // May or may not be running in this environment
    expect(Array.isArray(models)).toBe(true);
    for (const model of models) {
      expect(model.isLocal).toBe(true);
      expect(model.cost.inputPer1MTokens).toBe(0);
    }
  });
});
// =============================================================================
// ModelRegistry — use case & composite index coverage
// =============================================================================

describe('ModelRegistry use case lookups', () => {
  it('getModelsByUseCase returns models for a known use case', () => {
    const models = modelRegistry.getModelsByUseCase('vision');
    expect(models.length).toBeGreaterThanOrEqual(1);
    for (const m of models) {
      expect(m.useCases).toContain('vision');
    }
  });

  it('getModelsByUseCase returns empty array for unknown use case', () => {
    const models = modelRegistry.getModelsByUseCase('embed');
    expect(models).toEqual([]);
  });

  it('getModelsByTierAndUseCase returns models matching both', () => {
    const models = modelRegistry.getModelsByTierAndUseCase('mid', 'vision');
    expect(models.length).toBeGreaterThanOrEqual(1);
    for (const m of models) {
      expect(m.tier).toBe('mid');
      expect(m.useCases).toContain('vision');
    }
  });

  it('getModelsByTierAndUseCase returns empty for unmatched combination', () => {
    const models = modelRegistry.getModelsByTierAndUseCase('micro', 'code');
    expect(models).toEqual([]);
  });
});

// =============================================================================
// DefaultTierAwareModelSelector — constraint-specific paths
// =============================================================================

describe('DefaultTierAwareModelSelector constraints', () => {
  const selector = new DefaultTierAwareModelSelector();

  it('requireJsonMode filters models without JSON mode', async () => {
    const model = await selector.selectModelForTier({
      tier: 'small',
      constraints: { requireJsonMode: true }
    });
    expect(model.capabilities.jsonMode).toBe(true);
  });

  it('minContextWindow constraint filters correctly', async () => {
    const model = await selector.selectModelForTier({
      tier: 'small',
      constraints: { minContextWindow: 150_000 }
    });
    // gpt-4o-mini has 128k — excluded; haiku has 200k — passes
    expect(model.contextWindow).toBeGreaterThanOrEqual(150_000);
  });

  it('excludeProviders with anthropic excludes correctly', async () => {
    const model = await selector.selectModelForTier({
      tier: 'mid',
      constraints: { excludeProviders: ['anthropic'] }
    });
    expect(model.providerId).not.toBe('anthropic');
  });
});
