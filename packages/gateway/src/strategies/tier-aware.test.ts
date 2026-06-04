import { describe, expect, it } from 'vitest';
import type { ProviderEntry } from '../types.js';
import { PriorityFallbackStrategy, RoundRobinStrategy } from './strategies.js';
import type { SelectionContext } from './strategy.js';
import {
  buildTierOf,
  DEFAULT_PROVIDER_TIERS,
  ESCALATION_CHAIN,
  type ProviderTier,
  TierAwareStrategy
} from './tier-aware.js';

function entry(id: string, tier?: ProviderTier): ProviderEntry {
  return tier === undefined ? { id, name: id, provider: 'openai' } : { id, name: id, provider: 'openai', tier };
}

function ctx(tier?: ProviderTier): SelectionContext {
  return {
    health: new Map(),
    quota: new Map(),
    request: tier === undefined ? {} : { taskTier: tier }
  };
}

describe('TierAwareStrategy', () => {
  it('selects a provider in the requested tier', () => {
    const strategy = new TierAwareStrategy({
      defaultStrategy: new PriorityFallbackStrategy(),
      tierOf: buildTierOf({ local: 'micro', small: 'small', main: 'mid', big: 'frontier' })
    });
    const picked = strategy.select(
      [entry('big', 'frontier'), entry('main', 'mid'), entry('small', 'small'), entry('local', 'micro')],
      ctx('micro')
    );
    expect(picked?.id).toBe('local');
  });

  it('escalates to the next tier when the requested tier has no providers', () => {
    const strategy = new TierAwareStrategy({
      defaultStrategy: new PriorityFallbackStrategy(),
      tierOf: buildTierOf({ main: 'mid', big: 'frontier' })
    });
    const picked = strategy.select([entry('main', 'mid'), entry('big', 'frontier')], ctx('micro'));
    expect(picked?.id).toBe('main');
  });

  it('respects the default escalation chain order', () => {
    expect(ESCALATION_CHAIN).toEqual(['micro', 'small', 'mid', 'frontier']);
    const strategy = new TierAwareStrategy({
      defaultStrategy: new PriorityFallbackStrategy(),
      tierOf: buildTierOf({ main: 'mid' })
    });
    expect(strategy.select([entry('main', 'mid')], ctx('micro'))?.id).toBe('main');
  });

  it('falls back to the default strategy when the tier is unknown', () => {
    const fallback = new PriorityFallbackStrategy();
    const strategy = new TierAwareStrategy({
      defaultStrategy: fallback,
      tierOf: buildTierOf({ main: 'mid' })
    });
    expect(strategy.select([entry('main', 'mid')], ctx())?.id).toBe('main');
  });

  it('falls back to the default strategy when the chain is exhausted', () => {
    const strategy = new TierAwareStrategy({
      defaultStrategy: new RoundRobinStrategy(),
      maxEscalationSteps: 2,
      tierOf: buildTierOf({ main: 'mid' })
    });
    const picked = strategy.select([entry('main', 'mid'), entry('local', 'micro')], ctx('frontier'));
    expect(picked?.id).toBe('main');
  });

  it('skips providers that the default strategy filters out', () => {
    const fallback = new PriorityFallbackStrategy();
    const strategy = new TierAwareStrategy({
      defaultStrategy: fallback,
      tierOf: buildTierOf({ a: 'micro', b: 'micro' })
    });
    expect(strategy.select([entry('a', 'micro'), entry('b', 'micro')], ctx('micro'))?.id).toBe('a');
  });

  it('treats providers without a tier as ineligible for tier-aware selection', () => {
    const strategy = new TierAwareStrategy({
      defaultStrategy: new PriorityFallbackStrategy(),
      tierOf: buildTierOf({ a: 'micro' })
    });
    const noTier = entry('no-tier');
    const picked = strategy.select([noTier, entry('a', 'micro')], ctx('micro'));
    expect(picked?.id).toBe('a');
  });

  it('uses the default tier mapping when no tierOf override is given', () => {
    expect(DEFAULT_PROVIDER_TIERS.ollama).toBe('micro');
    expect(DEFAULT_PROVIDER_TIERS.openai).toBe('mid');
    expect(DEFAULT_PROVIDER_TIERS.anthropic).toBe('frontier');
  });
});
