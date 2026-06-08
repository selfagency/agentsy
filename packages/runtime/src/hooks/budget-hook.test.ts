import { describe, expect, it } from 'vitest';
import { createBudgetHook } from './budget-hook.js';
import type { PreModelCallEvent, RuntimeHookEvent } from './types.js';

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function createPreModelCall(overrides: Partial<PreModelCallEvent> = {}): PreModelCallEvent {
  return {
    estimatedTokens: 1000,
    logicalModelId: 'claude-sonnet-4',
    providerId: 'anthropic',
    replicaId: 'rep_01',
    sessionId: 'sess_test_001',
    type: 'PreModelCall',
    ...overrides
  };
}

function createNonPreModelCall(): RuntimeHookEvent {
  return {
    args: {},
    sessionId: 'sess_test_001',
    toolName: 'read',
    type: 'PreToolCall'
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBudgetHook', () => {
  it('returns handler, id, and priority', () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 64_000,
      outputCap: 16_384
    });

    expect(hook).toHaveProperty('handler');
    expect(typeof hook.handler).toBe('function');
    expect(hook.id).toBe('budget:enforce');
    expect(hook.priority).toBe(10);
  });

  it('continues when estimated tokens fit within budget', async () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 64_000,
      outputCap: 16_384
    });

    const result = await hook.handler(createPreModelCall({ estimatedTokens: 500 }));
    expect(result).toEqual({ continue: true });
  });

  it('blocks when estimated tokens exceed the input cap', async () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 64_000,
      outputCap: 16_384
    });

    const result = await hook.handler(createPreModelCall({ estimatedTokens: 100_000 }));
    expect(result).toEqual({
      continue: false,
      reason: 'Input budget exceeded: estimated 100000, cap 64000'
    });
  });

  it('returns yellow warning when cumulative usage crosses the threshold', async () => {
    const hook = createBudgetHook(
      {
        contextCap: 128_000,
        inputCap: 1000,
        outputCap: 16_384
      },
      { yellowThreshold: 0.5 }
    );

    // First call: 400 tokens — 400/1000 = 40%, below 50% threshold
    const first = await hook.handler(createPreModelCall({ estimatedTokens: 400 }));
    expect(first).toEqual({ continue: true });

    // Second call: 200 tokens — cumulative 600/1000 = 60%, above 50% threshold
    const second = await hook.handler(createPreModelCall({ estimatedTokens: 200 }));
    expect(second).toEqual({
      transform: { budgetWarning: 'yellow' }
    });
  });

  it('emits yellow warning only once per window', async () => {
    const hook = createBudgetHook(
      {
        contextCap: 128_000,
        inputCap: 1000,
        outputCap: 16_384
      },
      { yellowThreshold: 0.5 }
    );

    // First call: 400 tokens — 400/1000 = 40%, below 50% threshold
    const first = await hook.handler(createPreModelCall({ estimatedTokens: 400 }));
    expect(first).toEqual({ continue: true });

    // Second call pushes past threshold
    const second = await hook.handler(createPreModelCall({ estimatedTokens: 200 }));
    expect(second).toEqual({
      transform: { budgetWarning: 'yellow' }
    });

    // Third call — yellow already emitted, should just continue
    const third = await hook.handler(createPreModelCall({ estimatedTokens: 100 }));
    expect(third).toEqual({ continue: true });
  });

  it('continues for non-PreModelCall events', async () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 1000,
      outputCap: 16_384
    });

    const result = await hook.handler(createNonPreModelCall());
    expect(result).toEqual({ continue: true });
  });

  it('continues when estimated tokens are not finite', async () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 64_000,
      outputCap: 16_384
    });

    const result = await hook.handler(createPreModelCall({ estimatedTokens: Number.POSITIVE_INFINITY }));
    expect(result).toEqual({ continue: true });
  });

  it('isolates errors and continues', async () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 64_000,
      outputCap: 16_384
    });

    const result = await hook.handler({} as RuntimeHookEvent);
    expect(result).toEqual({ continue: true });
  });

  it('blocks when remaining budget is insufficient across calls', async () => {
    const hook = createBudgetHook({
      contextCap: 128_000,
      inputCap: 10_000,
      outputCap: 16_384
    });

    // First call: 6000 fits
    const first = await hook.handler(createPreModelCall({ estimatedTokens: 6000 }));
    expect(first).toEqual({ continue: true });

    // Second call: 5000 exceeds remaining (10000 - 6000 = 4000)
    const second = await hook.handler(createPreModelCall({ estimatedTokens: 5000 }));
    expect(second).toEqual({
      continue: false,
      reason: expect.stringContaining('Insufficient remaining input budget')
    });
  });
});
