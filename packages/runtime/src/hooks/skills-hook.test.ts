import { describe, expect, it, vi } from 'vitest';
import type { ActiveSkill, SkillDiscoverer } from './skills-hook.js';
import { createSkillsHook } from './skills-hook.js';
import type { HookResult, RuntimeHookEvent } from './types.js';

function createUserPromptEvent(overrides: Partial<RuntimeHookEvent> & { type: 'UserPromptSubmit' }): RuntimeHookEvent {
  return {
    input: 'hello world',
    sessionId: 'sess_1',
    ...overrides
  };
}

function createNonUserPromptEvent(type: RuntimeHookEvent['type']): RuntimeHookEvent {
  switch (type) {
    case 'PreToolCall':
      return {
        args: {},
        sessionId: 'sess_1',
        toolName: 'test',
        type
      };
    case 'Stop':
      return { reason: 'done', sessionId: 'sess_1', type };
    default:
      return { sessionId: 'sess_1', type } as RuntimeHookEvent;
  }
}

function makeSkillMetadata(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `skill-${i + 1}`,
    description: `Skill number ${i + 1}`,
    version: '1.0.0'
  }));
}

function makeActiveSkills(count: number): ActiveSkill[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `skill-${i + 1}`,
    description: `Skill number ${i + 1}`,
    tokenCount: 500
  }));
}

describe('createSkillsHook', () => {
  it('returns continue:true when no skills discovered', async () => {
    const discoverer: SkillDiscoverer = { discover: vi.fn().mockReturnValue([]) };
    const activator = { activate: vi.fn().mockResolvedValue([] as ActiveSkill[]) };
    const hook = createSkillsHook(discoverer, activator);
    const event = createUserPromptEvent({ type: 'UserPromptSubmit' });

    const result = await hook.handler(event);

    expect('transform' in result).toBe(true);
    const transform = (result as Extract<HookResult, { transform: unknown }>).transform as {
      activeSkills: ActiveSkill[];
    };
    expect(transform.activeSkills).toEqual([]);
    expect(discoverer.discover).toHaveBeenCalledOnce();
    expect(activator.activate).toHaveBeenCalledWith('hello world', []);
  });

  it('calls discoverer.discover() then activator.activate() with metadata', async () => {
    const metadata = makeSkillMetadata(2);
    const activeSkills = makeActiveSkills(1);
    const discoverer: SkillDiscoverer = { discover: vi.fn().mockReturnValue(metadata) };
    const activator = { activate: vi.fn().mockResolvedValue(activeSkills) };
    const hook = createSkillsHook(discoverer, activator);

    const result = await hook.handler(createUserPromptEvent({ type: 'UserPromptSubmit', input: 'build a dashboard' }));

    expect('transform' in result).toBe(true);
    const transform = (result as Extract<HookResult, { transform: unknown }>).transform as {
      activeSkills: ActiveSkill[];
    };
    expect(transform.activeSkills).toEqual(activeSkills);
    expect(discoverer.discover).toHaveBeenCalledOnce();
    expect(activator.activate).toHaveBeenCalledWith('build a dashboard', metadata);
  });

  it('includes totalTokens in transform payload', async () => {
    const metadata = makeSkillMetadata(3);
    const activeSkills = makeActiveSkills(3);
    const discoverer: SkillDiscoverer = { discover: vi.fn().mockReturnValue(metadata) };
    const activator = { activate: vi.fn().mockResolvedValue(activeSkills) };
    const hook = createSkillsHook(discoverer, activator);

    const result = await hook.handler(createUserPromptEvent({ type: 'UserPromptSubmit' }));

    const transform = (result as Extract<HookResult, { transform: unknown }>).transform as {
      totalTokens: number;
    };
    expect(transform.totalTokens).toBe(1500); // 3 * 500
  });

  it('skips non-UserPromptSubmit events', async () => {
    const discoverer: SkillDiscoverer = { discover: vi.fn() };
    const activator = { activate: vi.fn() };
    const hook = createSkillsHook(discoverer, activator);

    const result = await hook.handler(createNonUserPromptEvent('PreToolCall'));

    expect(result).toEqual({ continue: true });
    expect(discoverer.discover).not.toHaveBeenCalled();
    expect(activator.activate).not.toHaveBeenCalled();
  });

  it('isolates discoverer errors gracefully', async () => {
    const discoverer: SkillDiscoverer = {
      discover: vi.fn().mockImplementation(() => {
        throw new Error('Discovery failed');
      })
    };
    const activator = { activate: vi.fn() };
    const hook = createSkillsHook(discoverer, activator);

    const result = await hook.handler(createUserPromptEvent({ type: 'UserPromptSubmit' }));

    expect(result).toEqual({ continue: true });
  });

  it('isolates activator errors gracefully', async () => {
    const metadata = makeSkillMetadata(1);
    const discoverer: SkillDiscoverer = { discover: vi.fn().mockReturnValue(metadata) };
    const activator = {
      activate: vi.fn().mockRejectedValue(new Error('Activation failed'))
    };
    const hook = createSkillsHook(discoverer, activator);

    const result = await hook.handler(createUserPromptEvent({ type: 'UserPromptSubmit' }));

    expect(result).toEqual({ continue: true });
  });

  it('returns the correct id and priority', () => {
    const discoverer: SkillDiscoverer = { discover: vi.fn() };
    const activator = { activate: vi.fn() };
    const hook = createSkillsHook(discoverer, activator);

    expect(hook.id).toBe('skills:activate');
    expect(hook.priority).toBe(50);
  });
});
