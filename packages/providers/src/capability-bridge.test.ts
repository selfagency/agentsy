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
  it('maps ModelCapabilities fields to ProviderCapabilities', () => {
    const result = modelCapabilitiesToProviderRequirements({
      streaming: true,
      toolCalling: true,
      reasoning: false,
      batching: false
    });

    expect(result.streaming).toBe(true);
    expect(result.toolCalling).toBe(true);
    expect(result.reasoning).toBe(false);
    expect(result.batching).toBe(false);
  });

  it('includes budgeting when costTracking or tokenBudgeting is set', () => {
    const result = modelCapabilitiesToProviderRequirements({
      streaming: true,
      costTracking: true,
      tokenBudgeting: false
    });

    expect(result.budgeting).toBeDefined();
    expect(result.budgeting?.supportsCostTracking).toBe(true);
    expect(result.budgeting?.supportsTokenBudgeting).toBe(false);
  });

  it('excludes budgeting when neither costTracking nor tokenBudgeting is set', () => {
    const result = modelCapabilitiesToProviderRequirements({
      streaming: true,
      toolCalling: true
    });

    expect(result.budgeting).toBeUndefined();
  });

  it('includes budgeting with both sub-fields when both are set', () => {
    const result = modelCapabilitiesToProviderRequirements({
      streaming: true,
      costTracking: true,
      tokenBudgeting: true
    });

    expect(result.budgeting).toBeDefined();
    expect(result.budgeting?.supportsCostTracking).toBe(true);
    expect(result.budgeting?.supportsTokenBudgeting).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchCapabilities
// ---------------------------------------------------------------------------

describe('matchCapabilities', () => {
  const fullProvider: ProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    reasoning: true,
    batching: true
  };

  it('returns matches=true when all required capabilities are present', () => {
    const result = matchCapabilities({ streaming: true, toolCalling: true }, fullProvider);

    expect(result.matches).toBe(true);
    expect(result.missingCapabilities).toHaveLength(0);
    expect(result.score).toBe(1);
  });

  it('returns matches=false when a required capability is missing', () => {
    const result = matchCapabilities(
      { streaming: true, reasoning: true, batching: true },
      { streaming: true, toolCalling: false, reasoning: false, batching: true }
    );

    expect(result.matches).toBe(false);
    expect(result.missingCapabilities).toContain('reasoning');
  });

  it('returns match=true when missing capability is not required', () => {
    const result = matchCapabilities({ streaming: true, toolCalling: false }, fullProvider);

    expect(result.matches).toBe(true);
  });

  it('calculates score as matchCount / totalRequired', () => {
    const result = matchCapabilities(
      { streaming: true, toolCalling: true, reasoning: true, batching: true },
      { streaming: true, toolCalling: true, reasoning: false, batching: true }
    );

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0.75);
  });

  it('considers budgeting sub-capabilities', () => {
    const result = matchCapabilities(
      {
        streaming: true,
        budgeting: { supportsCostTracking: true, supportsTokenBudgeting: true }
      },
      {
        streaming: true,
        budgeting: { supportsCostTracking: true, supportsTokenBudgeting: false }
      }
    );

    expect(result.matches).toBe(false);
    // streaming ✓, costTracking ✓, tokenBudgeting ✗ → score 2/3
    expect(result.score).toBeCloseTo(2 / 3);
  });

  it('returns providerId as empty string when not set externally', () => {
    const result = matchCapabilities({ streaming: true }, fullProvider);

    expect(result.providerId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildProviderCapabilityProfile
// ---------------------------------------------------------------------------

describe('buildProviderCapabilityProfile', () => {
  it('builds a profile with capabilities', () => {
    const caps: ProviderCapabilities = { streaming: true, toolCalling: true, reasoning: true };
    const result = buildProviderCapabilityProfile('openai', caps);

    expect(result.providerId).toBe('openai');
    expect(result.capabilities.streaming).toBe(true);
    expect(result.capabilities.toolCalling).toBe(true);
    expect(result.capabilities.reasoning).toBe(true);
  });

  it('includes metadata when provided', () => {
    const caps: ProviderCapabilities = { streaming: true };
    const metadata = { localOnly: true, requiresAuth: false };
    const result = buildProviderCapabilityProfile('ollama', caps, metadata);

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.localOnly).toBe(true);
    expect(result.metadata?.requiresAuth).toBe(false);
  });

  it('omits metadata when not provided', () => {
    const caps: ProviderCapabilities = { streaming: false };
    const result = buildProviderCapabilityProfile('test', caps);

    expect(result.metadata).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// filterProvidersByCapabilities
// ---------------------------------------------------------------------------

describe('filterProvidersByCapabilities', () => {
  const providers = [
    buildProviderCapabilityProfile('anthropic', {
      streaming: true,
      toolCalling: true,
      reasoning: true,
      batching: true
    }),
    buildProviderCapabilityProfile('openai', {
      streaming: true,
      toolCalling: true,
      reasoning: false,
      batching: false
    }),
    buildProviderCapabilityProfile('ollama', {
      streaming: false,
      toolCalling: false,
      reasoning: false,
      batching: false
    })
  ];

  it('sorts matches before non-matches', () => {
    const result = filterProvidersByCapabilities(providers, {
      streaming: true,
      toolCalling: true,
      reasoning: true,
      batching: true
    });

    expect(result[0]?.providerId).toBe('anthropic');
    expect(result[0]?.matches).toBe(true);
  });

  it('assigns providerId to each result', () => {
    const result = filterProvidersByCapabilities(providers, {
      streaming: true
    });

    for (const entry of result) {
      expect(entry.providerId).toBeDefined();
    }
  });

  it('returns empty array for empty provider list', () => {
    const result = filterProvidersByCapabilities([], {
      streaming: true
    });

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// selectBestProvider
// ---------------------------------------------------------------------------

describe('selectBestProvider', () => {
  const providers = [
    buildProviderCapabilityProfile('anthropic', {
      streaming: true,
      toolCalling: true,
      reasoning: true,
      batching: true
    }),
    buildProviderCapabilityProfile('openai', {
      streaming: true,
      toolCalling: true,
      reasoning: false,
      batching: false
    })
  ];

  it('returns the best matching provider', () => {
    const result = selectBestProvider(providers, {
      streaming: true,
      toolCalling: true,
      reasoning: true,
      batching: true
    });

    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('anthropic');
  });

  it('returns null when no providers match', () => {
    const result = selectBestProvider(providers, {
      streaming: true,
      toolCalling: true,
      reasoning: true,
      batching: true,
      budgeting: { supportsCostTracking: true, supportsTokenBudgeting: true }
    });

    expect(result).toBeNull();
  });

  it('returns null for empty provider list', () => {
    const result = selectBestProvider([], { streaming: true });

    expect(result).toBeNull();
  });

  it('prefers the provider with higher match score', () => {
    const result = selectBestProvider(providers, {
      streaming: true,
      toolCalling: true,
      reasoning: true
    });

    expect(result?.providerId).toBe('anthropic');
  });
});
