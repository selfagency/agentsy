import { describe, expect, it } from 'vitest';

import { compileHooks } from './compile.js';
import type { HookDefinition } from './types.js';

function hook(name: string, overrides: Partial<HookDefinition> = {}): HookDefinition {
  const result: HookDefinition = {
    name,
    phase: overrides.phase ?? 'beforeToolCall',
    priority: overrides.priority ?? 50
  };
  if (overrides.enabled !== undefined) {
    result.enabled = overrides.enabled;
  }
  if (overrides.dependencies !== undefined) {
    result.dependencies = overrides.dependencies;
  }
  if (overrides.conflicts !== undefined) {
    result.conflicts = overrides.conflicts;
  }
  return result;
}

describe('compileHooks', () => {
  it('should throw when given an empty array', () => {
    expect(() => compileHooks([])).toThrow('compileHooks: at least one HookDefinition is required');
  });

  it('should return a HookExecutionPlan with ordered hooks', () => {
    const plan = compileHooks([hook('hook-a'), hook('hook-b')]);
    expect(plan.order).toBeDefined();
    expect(plan.order.length).toBe(2);
    expect(plan.order).toContain('hook-a');
    expect(plan.order).toContain('hook-b');
    expect(plan.warnings).toEqual([]);
  });

  it('should respect dependency order (topological sort)', () => {
    const plan = compileHooks([hook('hook-b', { dependencies: ['hook-a'] }), hook('hook-a')]);
    // hook-a should come before hook-b
    expect(plan.order.indexOf('hook-a')).toBeLessThan(plan.order.indexOf('hook-b'));
  });

  it('should sort by priority within the same DAG level', () => {
    const plan = compileHooks([hook('low', { priority: 20 }), hook('high', { priority: 80 })]);
    // higher priority first
    expect(plan.order[0]).toBe('high');
    expect(plan.order[1]).toBe('low');
  });

  it('should throw on cycle detection with cycle path in message', () => {
    expect(() =>
      compileHooks([
        hook('hook-a', { dependencies: ['hook-b'] }),
        hook('hook-b', { dependencies: ['hook-c'] }),
        hook('hook-c', { dependencies: ['hook-a'] })
      ])
    ).toThrow(/cycle/u);
  });

  it('should throw on unknown dependency reference', () => {
    expect(() => compileHooks([hook('hook-a', { dependencies: ['unknown-dep'] })])).toThrow(/unknown hook/u);
  });

  it('should detect conflicts and produce ConflictWarning', () => {
    const plan = compileHooks([
      hook('hook-a', {
        conflicts: [
          {
            hookName: 'hook-b',
            contextFields: ['systemPrompt'],
            reason: 'Both modify system prompt',
            strategy: 'merge'
          }
        ]
      }),
      hook('hook-b')
    ]);

    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]!.hook1).toBe('hook-a');
    expect(plan.warnings[0]!.hook2).toBe('hook-b');
    expect(plan.warnings[0]!.strategy).toBe('merge');
    expect(plan.warnings[0]!.reason).toBe('Both modify system prompt');
  });

  it('should deduplicate conflict warnings', () => {
    const plan = compileHooks([
      hook('hook-a', {
        conflicts: [
          {
            hookName: 'hook-b',
            contextFields: ['systemPrompt'],
            reason: 'Duplicate conflict',
            strategy: 'skip'
          }
        ]
      }),
      hook('hook-b', {
        conflicts: [
          {
            hookName: 'hook-a',
            contextFields: ['systemPrompt'],
            reason: 'Same conflict from other side',
            strategy: 'skip'
          }
        ]
      })
    ]);

    // Should produce exactly one warning (deduplicated)
    expect(plan.warnings).toHaveLength(1);
  });

  it('should detect duplicate names', () => {
    expect(() => compileHooks([hook('same-name'), hook('same-name')])).toThrow(/duplicate hook name/u);
  });
});
