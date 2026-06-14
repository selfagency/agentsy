import { describe, expect, it } from 'vitest';
import { createCortexKitBudgetProvider } from './budget-provider.js';

describe('createCortexKitBudgetProvider', () => {
  it('counts tokens for unknown model (falls through to default estimator)', () => {
    const provider = createCortexKitBudgetProvider();
    const count = provider.countTokens('hello world', 'unknown-model');
    expect(count).toBeGreaterThan(0);
  });

  it('counts tokens for known family fallback', () => {
    const provider = createCortexKitBudgetProvider();
    const count = provider.countTokens('hello world', 'claude-3-5-sonnet');
    expect(count).toBeGreaterThan(0);
  });

  it('returns cost factor > 0 for unknown model', () => {
    const provider = createCortexKitBudgetProvider();
    const factor = provider.costFactor('unknown-model');
    expect(factor).toBeGreaterThan(0);
  });

  it('returns cost factor for known family fallback', () => {
    const provider = createCortexKitBudgetProvider();
    const factor = provider.costFactor('gemini-2-0-flash');
    expect(factor).toBeGreaterThan(0);
  });

  it('exposes the registry', () => {
    const provider = createCortexKitBudgetProvider();
    expect(provider.getRegistry()).toBeDefined();
  });
});
