import { describe, expect, it } from 'vitest';
import { HookRegistry } from './registry.js';
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

describe('HookRegistry', () => {
  describe('register', () => {
    it('should register a valid hook definition', () => {
      const registry = new HookRegistry();
      registry.register(hook('test-hook'));
      expect(registry.getHook('test-hook')).toBeDefined();
      expect(registry.size).toBe(1);
    });

    it('should throw when hook has no name', () => {
      const registry = new HookRegistry();
      expect(() => registry.register({ name: '', phase: 'beforeToolCall', priority: 50 })).toThrow(
        'HookRegistry: hook must have a name'
      );
    });

    it('should prevent duplicate names', () => {
      const registry = new HookRegistry();
      registry.register(hook('dup-hook'));
      expect(() => registry.register(hook('dup-hook'))).toThrow('duplicate hook name');
    });
  });

  describe('unregister', () => {
    it('should remove a registered hook and return true', () => {
      const registry = new HookRegistry();
      registry.register(hook('removable'));
      const result = registry.unregister('removable');
      expect(result).toBe(true);
      expect(registry.getHook('removable')).toBeUndefined();
    });

    it('should return false for unknown hook', () => {
      const registry = new HookRegistry();
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });

  describe('getHook', () => {
    it('should return a hook by name', () => {
      const registry = new HookRegistry();
      registry.register(hook('find-me', { phase: 'onError', priority: 30 }));
      const found = registry.getHook('find-me');
      expect(found).toBeDefined();
      expect(found?.phase).toBe('onError');
    });

    it('should return undefined for unknown name', () => {
      const registry = new HookRegistry();
      expect(registry.getHook('unknown')).toBeUndefined();
    });
  });

  describe('listHooks', () => {
    it('should list all hooks', () => {
      const registry = new HookRegistry();
      registry.register(hook('a'));
      registry.register(hook('b'));
      expect(registry.listHooks()).toHaveLength(2);
    });

    it('should filter by phase', () => {
      const registry = new HookRegistry();
      registry.register(hook('before', { phase: 'beforeToolCall' }));
      registry.register(hook('after', { phase: 'afterToolCall' }));
      registry.register(hook('error', { phase: 'onError' }));

      const beforeHooks = registry.listHooks('beforeToolCall');
      expect(beforeHooks).toHaveLength(1);
      expect(beforeHooks[0]?.name).toBe('before');
    });
  });

  describe('getExecutionPlan', () => {
    it('should compile hooks and cache the result', () => {
      const registry = new HookRegistry();
      registry.register(hook('hook-a'));
      registry.register(hook('hook-b'));

      const plan1 = registry.getExecutionPlan();
      expect(plan1.order).toContain('hook-a');
      expect(plan1.order).toContain('hook-b');

      // Cache hit
      const plan2 = registry.getExecutionPlan();
      expect(plan2).toBe(plan1);
    });

    it('should invalidate cache on register', () => {
      const registry = new HookRegistry();
      registry.register(hook('first'));

      const plan1 = registry.getExecutionPlan();
      expect(plan1.order).toEqual(['first']);

      registry.register(hook('second'));
      const plan2 = registry.getExecutionPlan();
      expect(plan2.order).toContain('first');
      expect(plan2.order).toContain('second');
    });

    it('should return empty plan when no hooks registered', () => {
      const registry = new HookRegistry();
      const plan = registry.getExecutionPlan();
      expect(plan.order).toEqual([]);
      expect(plan.warnings).toEqual([]);
    });
  });

  describe('resolveConflicts', () => {
    it('should skip strategy: remove conflicting hook from order', () => {
      const registry = new HookRegistry();
      registry.register(hook('hook-a'));
      registry.register(
        hook('hook-b', {
          conflicts: [
            {
              hookName: 'hook-a',
              contextFields: ['field-x'],
              reason: 'test conflict',
              strategy: 'skip'
            }
          ]
        })
      );

      const plan = registry.getExecutionPlan();
      const order = registry.resolveConflicts(plan.warnings);

      // hook-b should be removed (skip strategy)
      expect(order).toContain('hook-a');
      expect(order).not.toContain('hook-b');
    });

    it('should fail strategy: throw on conflict', () => {
      const registry = new HookRegistry();
      registry.register(hook('hook-a'));
      registry.register(
        hook('hook-b', {
          conflicts: [
            {
              hookName: 'hook-a',
              contextFields: ['field-x'],
              reason: 'irreconcilable difference',
              strategy: 'fail'
            }
          ]
        })
      );

      const plan = registry.getExecutionPlan();
      expect(() => registry.resolveConflicts(plan.warnings)).toThrow('Hook conflict');
    });

    it('should return original order when no warnings given', () => {
      const registry = new HookRegistry();
      registry.register(hook('a'));
      registry.register(hook('b'));
      const order = registry.resolveConflicts([]);
      expect(order).toContain('a');
      expect(order).toContain('b');
    });
  });
});
