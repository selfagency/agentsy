import { describe, expect, it } from 'vitest';

import { createInMemoryTokenManager, PacingController } from './token-manager.js';

describe('createInMemoryTokenManager', () => {
  it('creates budgets, allocates tokens, and records released usage', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      maxCost: 5,
      maxTokens: 100,
      model: 'gpt-4.1-mini',
      name: 'default',
      periodMs: 60_000,
      priority: 'high',
      provider: 'openai',
      resetStrategy: 'rolling'
    });

    const allocation = await manager.requestTokens({
      budgetId: budget.id,
      estimatedCost: 1.5,
      estimatedTokens: 40,
      model: 'gpt-4.1-mini',
      provider: 'openai',
      requestType: 'completion'
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
      maxCost: 10,
      maxTokens: 100,
      model: 'gpt-4.1-mini',
      name: 'low',
      periodMs: 60_000,
      priority: 'low',
      provider: 'openai',
      resetStrategy: 'rolling'
    });

    const high = await manager.createBudget({
      maxCost: 10,
      maxTokens: 100,
      model: 'gpt-4.1-mini',
      name: 'high',
      periodMs: 60_000,
      priority: 'high',
      provider: 'openai',
      resetStrategy: 'rolling'
    });

    const allocation = await manager.requestTokens({
      estimatedTokens: 10,
      model: 'gpt-4.1-mini',
      provider: 'openai',
      requestType: 'completion'
    });

    expect(allocation.budgetId).toBe(high.id);
    expect(allocation.budgetId).not.toBe(low.id);
  });

  it('rejects requests that exceed the remaining budget', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      maxCost: 1,
      maxTokens: 10,
      model: 'gpt-4.1-mini',
      name: 'tiny',
      periodMs: 60_000,
      priority: 'medium',
      provider: 'openai',
      resetStrategy: 'rolling'
    });

    await expect(
      manager.requestTokens({
        budgetId: budget.id,
        estimatedTokens: 11,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        requestType: 'completion'
      })
    ).rejects.toThrow('exceeds the remaining token budget');
  });

  it('produces basic cost analysis and optimization suggestions', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      maxCost: 10,
      maxTokens: 100,
      model: 'gpt-4.1-mini',
      name: 'analysis',
      periodMs: 60_000,
      priority: 'medium',
      provider: 'openai',
      resetStrategy: 'rolling'
    });

    await manager.recordUsage({
      budgetId: budget.id,
      cost: 8.5,
      model: 'gpt-4.1-mini',
      provider: 'openai',
      requestType: 'completion',
      timestamp: new Date(),
      tokensUsed: 85
    });

    const analysis = await manager.getCostAnalysis(60_000);
    const suggestions = await manager.getOptimizationSuggestions(budget.id);

    expect(analysis.totalTokens).toBe(85);
    expect(analysis.totalCost).toBe(8.5);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('supports budget CRUD, filtering, and wildcard model selection', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      maxCost: 4,
      maxTokens: 200,
      metadata: { team: 'agents' },
      model: '*',
      name: 'wildcard',
      periodMs: 60_000,
      priority: 'medium',
      provider: 'anthropic',
      resetStrategy: 'manual'
    });

    const updated = await manager.updateBudget(budget.id, {
      metadata: { team: 'runtime' },
      name: 'wildcard-updated'
    });
    const fetched = await manager.getBudget(budget.id);
    const filtered = await manager.listBudgets({ provider: 'anthropic' });
    const allocation = await manager.requestTokens({
      estimatedCost: 0.5,
      estimatedTokens: 20,
      model: 'claude-3-7-sonnet',
      provider: 'anthropic',
      requestType: 'completion'
    });

    expect(updated.name).toBe('wildcard-updated');
    expect(fetched?.metadata).toStrictEqual({ team: 'runtime' });
    expect(filtered).toHaveLength(1);
    expect(allocation.budgetId).toBe(budget.id);

    await manager.deleteBudget(budget.id);

    await expect(manager.getBudget(budget.id)).resolves.toBeNull();
    await expect(manager.releaseTokens(allocation.id, 10, 0.25)).rejects.toThrow('Unknown token allocation');
  });

  it('counts manual-reset usage across older timestamps and rejects unmatched requests', async () => {
    const manager = createInMemoryTokenManager();
    const budget = await manager.createBudget({
      maxCost: 10,
      maxTokens: 100,
      model: 'gpt-4.1-mini',
      name: 'manual',
      periodMs: 1,
      priority: 'medium',
      provider: 'openai',
      resetStrategy: 'manual'
    });

    await manager.recordUsage({
      budgetId: budget.id,
      cost: 1,
      model: 'gpt-4.1-mini',
      provider: 'openai',
      requestType: 'completion',
      timestamp: new Date(Date.now() - 10_000),
      tokensUsed: 95
    });

    await expect(
      manager.requestTokens({
        budgetId: budget.id,
        estimatedTokens: 10,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        requestType: 'completion'
      })
    ).rejects.toThrow('exceeds the remaining token budget');

    await expect(
      manager.requestTokens({
        estimatedTokens: 1,
        model: 'missing',
        provider: 'missing',
        requestType: 'completion'
      })
    ).rejects.toThrow('No matching token budget found');
  });
});

describe('PacingController', () => {
  it('enforces provider rate limits and exposes wait time', async () => {
    const controller = new PacingController(createInMemoryTokenManager());
    controller.updateRateLimits('openai', [{ maxRequests: 1, windowMs: 1000 }]);

    await expect(
      controller.throttleRequest({
        estimatedTokens: 10,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        requestType: 'completion'
      })
    ).resolves.toBeTruthy();

    await expect(
      controller.throttleRequest({
        estimatedTokens: 10,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        requestType: 'completion'
      })
    ).resolves.toBeFalsy();

    const status = controller.checkRateLimit('openai');
    expect(status.allowed).toBeFalsy();
    expect(status.retryAfterMs).toBeGreaterThan(0);
  });

  it('applies adaptive cooldown feedback', () => {
    const controller = new PacingController(createInMemoryTokenManager());
    controller.adjustPacing({
      overloaded: true,
      provider: 'openai',
      retryAfterMs: 250
    });

    const wait = controller.getWaitTime({
      estimatedTokens: 10,
      model: 'gpt-4.1-mini',
      provider: 'openai',
      requestType: 'completion'
    });

    expect(wait).toBeGreaterThan(0);
  });

  it('evaluates each rate-limit window against the original timestamp history', async () => {
    const controller = new PacingController(createInMemoryTokenManager());
    controller.updateRateLimits('openai', [
      { maxRequests: 10, windowMs: 1000 },
      { maxRequests: 2, windowMs: 10_000 }
    ]);

    await expect(
      controller.throttleRequest({
        estimatedTokens: 10,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        requestType: 'completion'
      })
    ).resolves.toBeTruthy();
    await expect(
      controller.throttleRequest({
        estimatedTokens: 10,
        model: 'gpt-4.1-mini',
        provider: 'openai',
        requestType: 'completion'
      })
    ).resolves.toBeTruthy();

    const status = controller.checkRateLimit('openai');

    expect(status.allowed).toBeFalsy();
    expect(status.limit).toBe(2);
    expect(status.retryAfterMs).toBeGreaterThan(0);
  });

  it('clears cooldowns when overload feedback is resolved', () => {
    const controller = new PacingController(createInMemoryTokenManager());
    controller.adjustPacing({
      overloaded: true,
      provider: 'openai',
      retryAfterMs: 250
    });
    controller.adjustPacing({
      overloaded: false,
      provider: 'openai',
      retryAfterMs: 0
    });

    const wait = controller.getWaitTime({
      estimatedTokens: 10,
      model: 'gpt-4.1-mini',
      provider: 'openai',
      requestType: 'completion'
    });

    expect(wait).toBe(0);
  });
});
