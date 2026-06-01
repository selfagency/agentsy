import { describe, expect, it } from 'vitest';

import {
  buildProviderCapabilityProfile,
  filterProvidersByCapabilities,
  matchCapabilities,
  modelCapabilitiesToProviderRequirements,
  selectBestProvider
} from './capability-bridge.js';
import type { ProviderCapabilities } from './index.js';

// ---------------------------------------------------------------------------
// modelCapabilitiesToProviderRequirements
// ---------------------------------------------------------------------------

describe('modelCapabilitiesToProviderRequirements', () => {
  it('maps streaming true to streaming: true', () => {
    const result = modelCapabilitiesToProviderRequirements({ streaming: true });
    expect(result.streaming).toBe(true);
  });

  it('maps toolCalling true to toolCalling: true', () => {
    const result = modelCapabilitiesToProviderRequirements({ toolCalling: true });
    expect(result.toolCalling).toBe(true);
  });

  it('maps reasoning true to reasoning: true', () => {
    const result = modelCapabilitiesToProviderRequirements({ reasoning: true });
    expect(result.reasoning).toBe(true);
  });

  it('maps batching true to batching: true', () => {
    const result = modelCapabilitiesToProviderRequirements({ batching: true });
    expect(result.batching).toBe(true);
  });

  it('includes budgeting when costTracking is true', () => {
    const result = modelCapabilitiesToProviderRequirements({ costTracking: true });
    expect(result.budgeting?.supportsCostTracking).toBe(true);
  });

  it('includes budgeting when tokenBudgeting is true', () => {
    const result = modelCapabilitiesToProviderRequirements({ tokenBudgeting: true });
    expect(result.budgeting?.supportsTokenBudgeting).toBe(true);
  });

  it('includes both budgeting sub-fields when both are true', () => {
    const result = modelCapabilitiesToProviderRequirements({
      costTracking: true,
      tokenBudgeting: true
    });
    expect(result.budgeting).toStrictEqual({
      supportsCostTracking: true,
      supportsTokenBudgeting: true
    });
  });

  it('omits budgeting when neither costTracking nor tokenBudgeting is set', () => {
    const result = modelCapabilitiesToProviderRequirements({ streaming: true });
    expect(result.budgeting).toBeUndefined();
  });

  it('handles empty input', () => {
    const result = modelCapabilitiesToProviderRequirements({});
    expect(result.streaming).toBeUndefined();
    expect(result.toolCalling).toBeUndefined();
    expect(result.reasoning).toBeUndefined();
    expect(result.batching).toBeUndefined();
    expect(result.budgeting).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// matchCapabilities
// ---------------------------------------------------------------------------

describe('matchCapabilities', () => {
  it('returns matches=true and score=1 when all required are present', () => {
    const required: ProviderCapabilities = { streaming: true, toolCalling: true };
    const provided: ProviderCapabilities = { streaming: true, toolCalling: true };
    const result = matchCapabilities(required, provided);
    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
    expect(result.missingCapabilities).toHaveLength(0);
  });

  it('returns matches=false when a required capability is missing', () => {
    const required: ProviderCapabilities = { streaming: true, toolCalling: true };
    const provided: ProviderCapabilities = { streaming: true };
    const result = matchCapabilities(required, provided);
    expect(result.matches).toBe(false);
    expect(result.missingCapabilities).toContain('toolCalling');
  });

  it('returns matches=true when no capabilities are required', () => {
    const result = matchCapabilities({}, { streaming: true });
    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  it('treats required=false as not required (no mismatch when provided=true)', () => {
    const required: ProviderCapabilities = { streaming: false };
    const provided: ProviderCapabilities = { streaming: true };
    const result = matchCapabilities(required, provided);
    expect(result.missingCapabilities).not.toContain('streaming');
    expect(result.matches).toBe(true);
  });

  it('reports missing when required is true but provided is false', () => {
    const required: ProviderCapabilities = { streaming: true };
    const provided: ProviderCapabilities = { streaming: false };
    const result = matchCapabilities(required, provided);
    expect(result.missingCapabilities).toContain('streaming');
    expect(result.matches).toBe(false);
  });

  it('checks budgeting costTracking sub-capability', () => {
    const required: ProviderCapabilities = {
      budgeting: { supportsCostTracking: true }
    };
    const provided: ProviderCapabilities = {
      budgeting: { supportsCostTracking: false }
    };
    const result = matchCapabilities(required, provided);
    expect(result.missingCapabilities).toContain('costTracking');
    expect(result.matches).toBe(false);
  });

  it('checks budgeting tokenBudgeting sub-capability', () => {
    const required: ProviderCapabilities = {
      budgeting: { supportsTokenBudgeting: true }
    };
    const provided: ProviderCapabilities = {};
    const result = matchCapabilities(required, provided);
    expect(result.missingCapabilities).toContain('tokenBudgeting');
    expect(result.matches).toBe(false);
  });

  it('handles missing budgeting object on provider side', () => {
    const required: ProviderCapabilities = {
      budgeting: { supportsCostTracking: true }
    };
    const provided: ProviderCapabilities = {};
    const result = matchCapabilities(required, provided);
    expect(result.missingCapabilities).toContain('costTracking');
    expect(result.matches).toBe(false);
  });

  it('calculates partial score correctly', () => {
    const required: ProviderCapabilities = {
      streaming: true,
      toolCalling: true,
      reasoning: true
    };
    const provided: ProviderCapabilities = { streaming: true, toolCalling: true };
    const result = matchCapabilities(required, provided);
    expect(result.score).toBe(2 / 3);
    expect(result.matches).toBe(false);
  });

  it('always sets providerId to empty string from matchCapabilities', () => {
    const result = matchCapabilities({ streaming: true }, { streaming: true });
    expect(result.providerId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildProviderCapabilityProfile
// ---------------------------------------------------------------------------

describe('buildProviderCapabilityProfile', () => {
  it('builds a profile with providerId and capabilities', () => {
    const profile = buildProviderCapabilityProfile('openai', {
      streaming: true,
      toolCalling: true
    });
    expect(profile.providerId).toBe('openai');
    expect(profile.capabilities.streaming).toBe(true);
    expect(profile.capabilities.toolCalling).toBe(true);
  });

  it('includes metadata when provided', () => {
    const profile = buildProviderCapabilityProfile(
      'ollama',
      { streaming: true },
      {
        localOnly: true,
        requiresAuth: false
      }
    );
    expect(profile.metadata?.localOnly).toBe(true);
    expect(profile.metadata?.requiresAuth).toBe(false);
  });

  it('omits metadata when not provided', () => {
    const profile = buildProviderCapabilityProfile('openai', { streaming: true });
    expect(profile.metadata).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// filterProvidersByCapabilities
// ---------------------------------------------------------------------------

describe('filterProvidersByCapabilities', () => {
  const providers = [
    buildProviderCapabilityProfile('openai', { streaming: true, toolCalling: true, reasoning: true }),
    buildProviderCapabilityProfile('ollama', { streaming: true, toolCalling: false }),
    buildProviderCapabilityProfile('anthropic', { streaming: true, toolCalling: true, reasoning: false })
  ];

  it('returns all providers sorted by match status then score', () => {
    const required: ProviderCapabilities = { streaming: true, toolCalling: true };
    const results = filterProvidersByCapabilities(providers, required);

    // Matched providers first (openai, anthropic both score 1)
    expect(results[0]?.providerId).toBe('openai');
    expect(results[0]?.matches).toBe(true);
    expect(results[0]?.score).toBe(1);

    // Then non-matches (ollama: toolCalling=false)
    const nonMatch = results.find(r => !r.matches);
    expect(nonMatch?.providerId).toBe('ollama');
  });

  it('returns all providers when no requirements given', () => {
    const results = filterProvidersByCapabilities(providers, {});
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.matches).toBe(true);
    }
  });

  it('sets providerId on each result', () => {
    const required: ProviderCapabilities = { streaming: true };
    const results = filterProvidersByCapabilities(providers, required);
    expect(results.map(r => r.providerId).sort((a, b) => a.localeCompare(b))).toStrictEqual([
      'anthropic',
      'ollama',
      'openai'
    ]);
  });

  it('handles empty provider list', () => {
    const results = filterProvidersByCapabilities([], { streaming: true });
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// selectBestProvider
// ---------------------------------------------------------------------------

describe('selectBestProvider', () => {
  const providers = [
    buildProviderCapabilityProfile('openai', { streaming: true, toolCalling: true, reasoning: true }),
    buildProviderCapabilityProfile('ollama', { streaming: true, toolCalling: false }),
    buildProviderCapabilityProfile('anthropic', { streaming: true, toolCalling: true, reasoning: false })
  ];

  it('returns the best matching provider', () => {
    const result = selectBestProvider(providers, {
      streaming: true,
      toolCalling: true
    });
    expect(result?.providerId).toBe('openai');
  });

  it('returns null when no provider matches all requirements', () => {
    const result = selectBestProvider(providers, { reasoning: true, batching: true });
    // openai matches reasoning but not batching
    expect(result).toBeNull();
  });

  it('returns null for empty provider list', () => {
    const result = selectBestProvider([], { streaming: true });
    expect(result).toBeNull();
  });

  it('returns first provider when requirements are empty', () => {
    const result = selectBestProvider(providers, {});
    expect(result?.providerId).toBe('openai');
  });

  it('prefers provider with higher match score', () => {
    const tied = [
      buildProviderCapabilityProfile('a', { streaming: true, toolCalling: true }),
      buildProviderCapabilityProfile('b', { streaming: true, toolCalling: true, reasoning: true })
    ];
    const result = selectBestProvider(tied, {
      streaming: true,
      toolCalling: true,
      reasoning: true
    });
    expect(result?.providerId).toBe('b');
  });
});
