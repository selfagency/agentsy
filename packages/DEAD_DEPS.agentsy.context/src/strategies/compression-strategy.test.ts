import { describe, expect, it } from 'vitest';
import { createAnchoredIterativeStrategy } from './anchored-iterative.js';
import { createCompressionStrategyRegistry } from './compression-strategy.js';
import { createNaiveDroppingStrategy } from './naive-dropping.js';

describe('compression strategy registry', () => {
  it('registers and resolves strategies by name', () => {
    const registry = createCompressionStrategyRegistry();
    registry.register(createNaiveDroppingStrategy());
    registry.register(createAnchoredIterativeStrategy());

    expect(registry.resolve('naive-dropping')?.name).toBe('naive-dropping');
    expect(registry.resolve('anchored-iterative')?.name).toBe('anchored-iterative');
  });

  it('returns null for missing strategies', () => {
    const registry = createCompressionStrategyRegistry();

    expect(registry.resolve('missing')).toBeNull();
  });
});
