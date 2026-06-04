import { describe, expect, it } from 'vitest';
import type { ProviderEntry } from '../types.js';
import { LOCAL_BACKEND_PROFILES, type LocalPlatformProfile, registerLocalProviders } from './local-providers.js';

describe('registerLocalProviders', () => {
  it('registers every available local backend with tier=micro', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [
        { id: 'ollama', available: true },
        { id: 'lm-studio', available: true }
      ]
    };
    const entries: ProviderEntry[] = [];
    const result = registerLocalProviders(profile, entries);
    expect(result.registered).toBe(2);
    expect(result.providers).toHaveLength(2);
    for (const entry of result.providers) {
      expect(entry.tier).toBe('micro');
    }
    expect(entries).toEqual(result.providers);
  });

  it('skips backends that report unavailable', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [
        { id: 'ollama', available: true },
        { id: 'lm-studio', available: false }
      ]
    };
    const entries: ProviderEntry[] = [];
    const result = registerLocalProviders(profile, entries);
    expect(result.registered).toBe(1);
    expect(result.providers[0]?.id).toBe('local-ollama');
  });

  it('skips unknown backend ids', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [{ id: 'mystery-ml', available: true }]
    };
    const result = registerLocalProviders(profile, []);
    expect(result.registered).toBe(0);
    expect(result.providers).toEqual([]);
  });

  it('uses accelerator baseUrl when supplied (overriding the built-in default)', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [{ id: 'ollama', available: true, baseUrl: 'http://nas.lan:11434/v1' }]
    };
    const result = registerLocalProviders(profile, []);
    expect(result.providers[0]?.baseUrl).toBe('http://nas.lan:11434/v1');
  });

  it('places the preferred provider first', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [
        { id: 'ollama', available: true },
        { id: 'apfel', available: true }
      ]
    };
    const result = registerLocalProviders(profile, [], { preferProvider: 'apfel' });
    expect(result.providers[0]?.id).toBe('local-apfel');
    expect(result.providers[1]?.id).toBe('local-ollama');
  });

  it('applies defaultContextWindow override to every registered provider', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [{ id: 'ollama', available: true }]
    };
    const result = registerLocalProviders(profile, [], { defaultContextWindow: 65_536 });
    expect(result.providers[0]?.model).toBe(LOCAL_BACKEND_PROFILES.ollama?.defaultModel);
  });

  it('returns an empty result when no accelerators are present', () => {
    const profile: LocalPlatformProfile = { accelerators: [] };
    const result = registerLocalProviders(profile, []);
    expect(result).toEqual({ providers: [], registered: 0 });
  });

  it('appends to the supplied entries array in registration order', () => {
    const profile: LocalPlatformProfile = {
      accelerators: [{ id: 'vllm', available: true }]
    };
    const entries: ProviderEntry[] = [{ id: 'cloud', name: 'cloud', provider: 'openai' }];
    registerLocalProviders(profile, entries);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).toBe('cloud');
    expect(entries[1]?.id).toBe('local-vllm');
  });
});
