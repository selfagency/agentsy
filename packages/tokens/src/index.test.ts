import { describe, expect, it } from 'vitest';
import { PacingController, compressConversation, createInMemoryTokenManager, createTokenLedger } from './index.js';

describe('createTokenLedger', () => {
  it('consumes tokens within budget', () => {
    const ledger = createTokenLedger({ limit: 10 });

    expect(ledger.consume(4)).toBe(true);
    expect(ledger.remaining()).toBe(6);
  });

  it('rejects negative and over-budget token usage', () => {
    const ledger = createTokenLedger({ limit: 5 });

    expect(ledger.consume(-1)).toBe(false);
    expect(ledger.consume(6)).toBe(false);
    expect(ledger.remaining()).toBe(5);
  });
});

describe('createInMemoryTokenManager', () => {
  it('creates budgets, allocates tokens, and records released usage', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      name: 'default',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      maxTokens: 100,
      maxCost: 5,
      periodMs: 60_000,
      resetStrategy: 'rolling',
      priority: 'high',
    });

    const allocation = await manager.requestTokens({
      budgetId: budget.id,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      estimatedTokens: 40,
      estimatedCost: 1.5,
      requestType: 'completion',
    });

    expect(allocation.budgetId).toBe(budget.id);
    expect(allocation.allocatedTokens).toBe(40);

    await manager.releaseTokens(allocation.id, 32, 1.2);

    const usage = await manager.getUsage({ budgetId: budget.id });
    expect(usage).toHaveLength(1);
    expect(usage[0]?.tokensUsed).toBe(32);
    expect(usage[0]?.cost).toBe(1.2);
  });

  it('auto-selects a matching budget when requestTokens omits budgetId', async () => {
    const manager = createInMemoryTokenManager();

    const low = await manager.createBudget({
      name: 'low',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      maxTokens: 100,
      maxCost: 10,
      periodMs: 60_000,
      resetStrategy: 'rolling',
      priority: 'low',
    });

    const high = await manager.createBudget({
      name: 'high',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      maxTokens: 100,
      maxCost: 10,
      periodMs: 60_000,
      resetStrategy: 'rolling',
      priority: 'high',
    });

    const allocation = await manager.requestTokens({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      estimatedTokens: 10,
      requestType: 'completion',
    });

    expect(allocation.budgetId).toBe(high.id);
    expect(allocation.budgetId).not.toBe(low.id);
  });

  it('rejects requests that exceed the remaining budget', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      name: 'tiny',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      maxTokens: 10,
      maxCost: 1,
      periodMs: 60_000,
      resetStrategy: 'rolling',
      priority: 'medium',
    });

    await expect(
      manager.requestTokens({
        budgetId: budget.id,
        provider: 'openai',
        model: 'gpt-4.1-mini',
        estimatedTokens: 11,
        requestType: 'completion',
      }),
    ).rejects.toThrow('exceeds the remaining token budget');
  });

  it('produces basic cost analysis and optimization suggestions', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      name: 'analysis',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      maxTokens: 100,
      maxCost: 10,
      periodMs: 60_000,
      resetStrategy: 'rolling',
      priority: 'medium',
    });

    await manager.recordUsage({
      budgetId: budget.id,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      tokensUsed: 85,
      cost: 8.5,
      timestamp: new Date(),
      requestType: 'completion',
    });

    const analysis = await manager.getCostAnalysis(60_000);
    const suggestions = await manager.getOptimizationSuggestions(budget.id);

    expect(analysis.totalTokens).toBe(85);
    expect(analysis.totalCost).toBe(8.5);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe('compressConversation', () => {
  it('drops the oldest messages until the estimated token budget fits', () => {
    const result = compressConversation(['aaaa', 'bbbb', 'cccc', 'dddd'], {
      maxTokens: 8,
      estimateTokens: (value: string) => value.length,
      preserveLast: 1,
    });

    expect(result.compressed).toBe(true);
    expect(result.messages).toEqual(['cccc', 'dddd']);
    expect(result.droppedCount).toBe(2);
    expect(result.estimatedTokens).toBe(8);
  });
});

describe('PacingController', () => {
  it('enforces provider rate limits and exposes wait time', async () => {
    const controller = new PacingController(createInMemoryTokenManager());
    await controller.updateRateLimits('openai', [{ windowMs: 1_000, maxRequests: 1 }]);

    expect(
      await controller.throttleRequest({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        estimatedTokens: 10,
        requestType: 'completion',
      }),
    ).toBe(true);

    expect(
      await controller.throttleRequest({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        estimatedTokens: 10,
        requestType: 'completion',
      }),
    ).toBe(false);

    const status = await controller.checkRateLimit('openai');
    expect(status.allowed).toBe(false);
    expect(status.retryAfterMs).toBeGreaterThan(0);
  });

  it('applies adaptive cooldown feedback', async () => {
    const controller = new PacingController(createInMemoryTokenManager());
    await controller.adjustPacing({ provider: 'openai', overloaded: true, retryAfterMs: 250 });

    const wait = await controller.getWaitTime({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      estimatedTokens: 10,
      requestType: 'completion',
    });

    expect(wait).toBeGreaterThan(0);
  });
});
