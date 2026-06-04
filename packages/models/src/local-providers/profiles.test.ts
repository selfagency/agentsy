import { describe, expect, it } from 'vitest';

import { getLocalProviderProfile, listLocalProviderProfiles } from './profiles.js';

describe('local provider profiles', () => {
  it('lists canonical local provider profiles', () => {
    const profiles = listLocalProviderProfiles();

    expect(profiles.map(profile => profile.id)).toEqual(['ollama', 'vllm']);
    expect(profiles[0]?.protocol).toBe('ollama-native');
    expect(profiles[1]?.modelsEndpoint).toBe('/v1/models');
  });

  it('gets a provider profile by id', () => {
    expect(getLocalProviderProfile('vllm')).toMatchObject({
      defaultBaseUrl: 'http://localhost:8000',
      displayName: 'vLLM',
      id: 'vllm',
      protocol: 'openai-compatible'
    });
  });
});
