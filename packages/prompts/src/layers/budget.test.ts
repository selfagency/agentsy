/* oxlint-disable import/no-extraneous-dependencies -- test file */
import { describe, expect, it } from 'vitest';
import { allocateBudget, type BudgetAllocation } from './budget.js';
import type { InstructionsLayer } from './instructions.js';
import type { SkillsLayer } from './skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function instructionsLayer(overrides: Partial<InstructionsLayer> & { tokenCount: number }): InstructionsLayer {
  return {
    type: 'instructions',
    content: overrides.content ?? '',
    priority: overrides.priority ?? 0,
    tokenCount: overrides.tokenCount
  };
}

function skillsLayer(overrides: Partial<SkillsLayer> & { tokenCount: number }): SkillsLayer {
  return {
    type: 'skills',
    skills: overrides.skills ?? [],
    tokenCount: overrides.tokenCount
  };
}

// ---------------------------------------------------------------------------
// BudgetAllocation type
// ---------------------------------------------------------------------------

describe('BudgetAllocation type', () => {
  it('creates an allocation with required fields', () => {
    const allocation: BudgetAllocation = {
      baseline: 100,
      task: 200,
      remaining: 0,
      total: 300
    };
    expect(allocation.baseline).toBe(100);
    expect(allocation.task).toBe(200);
    expect(allocation.remaining).toBe(0);
    expect(allocation.total).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// allocateBudget
// ---------------------------------------------------------------------------

describe('allocateBudget', () => {
  it('sets baseline to sum of instruction-layer token counts', () => {
    const result = allocateBudget(500, [
      instructionsLayer({ tokenCount: 30 }),
      skillsLayer({ tokenCount: 10 }),
      instructionsLayer({ tokenCount: 70 })
    ]);
    expect(result.baseline).toBe(100);
  });

  it('sets task to total minus baseline', () => {
    const result = allocateBudget(500, [instructionsLayer({ tokenCount: 100 })]);
    expect(result.task).toBe(400);
  });

  it('sets remaining to 0', () => {
    const result = allocateBudget(100, [instructionsLayer({ tokenCount: 40 })]);
    expect(result.remaining).toBe(0);
  });

  it('carries total through unchanged', () => {
    const result = allocateBudget(999, [instructionsLayer({ tokenCount: 50 })]);
    expect(result.total).toBe(999);
  });

  it('ignores skill layers in baseline calculation', () => {
    const result = allocateBudget(200, [skillsLayer({ tokenCount: 999 }), instructionsLayer({ tokenCount: 50 })]);
    expect(result.baseline).toBe(50);
    expect(result.task).toBe(150);
  });

  it('handles empty layers array', () => {
    const result = allocateBudget(300, []);
    expect(result.baseline).toBe(0);
    expect(result.task).toBe(300);
    expect(result.remaining).toBe(0);
    expect(result.total).toBe(300);
  });

  it('handles zero total budget', () => {
    const result = allocateBudget(0, [instructionsLayer({ tokenCount: 0 })]);
    expect(result.baseline).toBe(0);
    expect(result.task).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.total).toBe(0);
  });

  it('computes correctly when baseline exceeds total', () => {
    const result = allocateBudget(50, [instructionsLayer({ tokenCount: 100 })]);
    expect(result.baseline).toBe(100);
    expect(result.task).toBe(-50);
  });
});
