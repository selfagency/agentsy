import { describe, expect, it, vi } from 'vitest';

import { ModelSwitcher } from './switcher.js';
import type { ProviderEntry } from './types.js';

function entry(overrides: Partial<ProviderEntry> = {}): ProviderEntry {
  return {
    id: 'openai-main',
    name: 'openai-main',
    provider: 'openai',
    ...overrides
  };
}

describe('ModelSwitcher', () => {
  it('starts with the first provider model and id', () => {
    const setActiveModel = vi.fn();
    const switcher = new ModelSwitcher({
      providers: [entry({ model: 'gpt-4o' })],
      setActiveModel
    });
    expect(switcher.getCurrentConfig()).toEqual({
      model: 'gpt-4o',
      provider: 'openai-main'
    });
    expect(setActiveModel).not.toHaveBeenCalled();
  });

  it('returns empty model when no providers are configured', () => {
    const switcher = new ModelSwitcher({ providers: [], setActiveModel: vi.fn() });
    expect(switcher.getCurrentConfig()).toEqual({ model: '', provider: '' });
  });

  it('switches to a model via the alias map', () => {
    const setActiveModel = vi.fn();
    const switcher = new ModelSwitcher({
      providers: [entry()],
      setActiveModel
    });
    const result = switcher.switch({ model: 'gpt-4o' });
    expect(result).toEqual({ model: 'gpt-4o', provider: 'openai-main' });
    expect(setActiveModel).toHaveBeenCalledWith('gpt-4o', expect.objectContaining({ id: 'openai-main' }));
    expect(switcher.getCurrentConfig()).toEqual({
      model: 'gpt-4o',
      provider: 'openai-main'
    });
  });

  it('resolves the provider-specific upstream id for an alias', () => {
    const setActiveModel = vi.fn();
    const switcher = new ModelSwitcher({
      providers: [
        entry({ id: 'anthropic-main', provider: 'anthropic' }),
        entry({ id: 'openai-main', provider: 'openai' })
      ],
      setActiveModel
    });
    switcher.switch({ model: 'claude-opus-4' });
    expect(setActiveModel).toHaveBeenCalledWith(
      'claude-opus-4-20250514',
      expect.objectContaining({ id: 'anthropic-main' })
    );
  });

  it('uses the explicit provider override when given', () => {
    const setActiveModel = vi.fn();
    const switcher = new ModelSwitcher({
      providers: [entry({ id: 'a', provider: 'anthropic' }), entry({ id: 'b', provider: 'openai' })],
      setActiveModel
    });
    switcher.switch({ model: 'gpt-4o-mini', provider: 'b' });
    expect(setActiveModel).toHaveBeenCalledWith('gpt-4o-mini', expect.objectContaining({ id: 'b' }));
  });

  it('throws when an explicit provider is unknown', () => {
    const switcher = new ModelSwitcher({
      providers: [entry()],
      setActiveModel: vi.fn()
    });
    expect(() => switcher.switch({ model: 'gpt-4o', provider: 'nope' })).toThrow(/unknown provider/i);
  });

  it('throws when no providers are configured', () => {
    const switcher = new ModelSwitcher({ providers: [], setActiveModel: vi.fn() });
    expect(() => switcher.switch({ model: 'gpt-4o' })).toThrow(/no providers/i);
  });

  it('falls back to a provider that declares the model directly', () => {
    const setActiveModel = vi.fn();
    const switcher = new ModelSwitcher({
      providers: [entry({ id: 'x', provider: 'openai', model: 'gpt-4o-mini' })],
      setActiveModel
    });
    switcher.switch({ model: 'gpt-4o-mini' });
    expect(setActiveModel).toHaveBeenCalledWith('gpt-4o-mini', expect.objectContaining({ id: 'x' }));
  });

  it('getSupportedModels merges per-provider models with alias-map entries', () => {
    const switcher = new ModelSwitcher({
      providers: [
        entry({ id: 'a', provider: 'openai', model: 'gpt-4o-mini' }),
        entry({ id: 'b', provider: 'anthropic' })
      ],
      setActiveModel: vi.fn()
    });
    const models = switcher.getSupportedModels();
    expect(models).toEqual(
      expect.arrayContaining([
        { alias: '', provider: 'a', upstreamModel: 'gpt-4o-mini' },
        { alias: 'claude-opus-4', provider: 'b', upstreamModel: 'claude-opus-4-20250514' }
      ])
    );
  });

  it('deduplicates alias-map entries that overlap with per-provider models', () => {
    const switcher = new ModelSwitcher({
      providers: [entry({ provider: 'openai', model: 'gpt-4o' })],
      setActiveModel: vi.fn()
    });
    const models = switcher.getSupportedModels();
    const gptEntries = models.filter(m => m.upstreamModel === 'gpt-4o');
    expect(gptEntries).toHaveLength(1);
  });

  it('skips alias-map providers that are not in the configured registry', () => {
    const switcher = new ModelSwitcher({
      providers: [entry({ provider: 'openai' })],
      setActiveModel: vi.fn()
    });
    const models = switcher.getSupportedModels();
    const claudeEntries = models.filter(m => m.upstreamModel.startsWith('claude'));
    expect(claudeEntries).toHaveLength(0);
  });
});
