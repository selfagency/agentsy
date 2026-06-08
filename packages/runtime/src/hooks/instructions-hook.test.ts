import { describe, expect, it, vi } from 'vitest';
import type { InstructionsDiscoverer } from './instructions-hook.js';
import { createInstructionsHook } from './instructions-hook.js';
import type { HookResult, RuntimeHookEvent } from './types.js';

function createPreModelCallEvent(overrides: Partial<RuntimeHookEvent> & { type: 'PreModelCall' }): RuntimeHookEvent {
  return {
    estimatedTokens: 1000,
    logicalModelId: 'gpt-4',
    providerId: 'openai',
    replicaId: 'replica_1',
    sessionId: 'sess_1',
    ...overrides
  };
}

function createNonPreModelCallEvent(type: RuntimeHookEvent['type']): RuntimeHookEvent {
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

function makeInstructionFiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    alwaysInject: true,
    content: `Instruction ${i + 1}: follow the rules.`,
    path: `/path/to/instructions-${i + 1}.md`,
    priority: 100 - i * 20,
    scope: i === 0 ? 'global' : 'workspace'
  }));
}

describe('createInstructionsHook', () => {
  it('returns continue:true and no transform when no instructions discovered', async () => {
    const discoverer: InstructionsDiscoverer = { discover: vi.fn().mockReturnValue([]) };
    const hook = createInstructionsHook(discoverer);
    const event = createPreModelCallEvent({ type: 'PreModelCall' });

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(discoverer.discover).toHaveBeenCalledOnce();
  });

  it('returns transform with composed instructions', async () => {
    const instructions = makeInstructionFiles(2);
    const discoverer: InstructionsDiscoverer = { discover: vi.fn().mockReturnValue(instructions) };
    const hook = createInstructionsHook(discoverer);
    const event = createPreModelCallEvent({ type: 'PreModelCall' });

    const result = await hook.handler(event);

    expect('transform' in result).toBe(true);
    const transform = (result as Extract<HookResult, { transform: unknown }>).transform as {
      type: string;
      content: string;
      tokenCount: number;
      instructionCount: number;
    };
    expect(transform.type).toBe('instructions:inject');
    expect(transform.content).toContain('Instruction 1');
    expect(transform.content).toContain('Instruction 2');
    expect(transform.instructionCount).toBe(2);
  });

  it('sorts instructions by priority descending', async () => {
    const instructions = [
      {
        alwaysInject: true,
        content: 'Low priority instruction.',
        path: '/path/low.md',
        priority: 20
      },
      {
        alwaysInject: true,
        content: 'High priority instruction.',
        path: '/path/high.md',
        priority: 100
      }
    ];
    const discoverer: InstructionsDiscoverer = { discover: vi.fn().mockReturnValue(instructions) };
    const hook = createInstructionsHook(discoverer);

    const result = await hook.handler(createPreModelCallEvent({ type: 'PreModelCall' }));
    const transform = (result as Extract<HookResult, { transform: unknown }>).transform as {
      content: string;
    };

    // High priority should come first
    const parts = transform.content.split('\n\n');
    expect(parts[0]).toBe('High priority instruction.');
    expect(parts[1]).toBe('Low priority instruction.');
  });

  it('returns tokenCount in transform payload', async () => {
    const instructions = makeInstructionFiles(1);
    const discoverer: InstructionsDiscoverer = { discover: vi.fn().mockReturnValue(instructions) };
    const hook = createInstructionsHook(discoverer);

    const result = await hook.handler(createPreModelCallEvent({ type: 'PreModelCall' }));
    const transform = (result as Extract<HookResult, { transform: unknown }>).transform as {
      tokenCount: number;
    };

    // "Instruction 1: follow the rules." = 32 chars / 4 = 8 tokens
    expect(transform.tokenCount).toBe(8);
  });

  it('skips non-PreModelCall events', async () => {
    const discoverer: InstructionsDiscoverer = { discover: vi.fn() };
    const hook = createInstructionsHook(discoverer);

    const result = await hook.handler(createNonPreModelCallEvent('PreToolCall'));

    expect(result).toEqual({ continue: true });
    expect(discoverer.discover).not.toHaveBeenCalled();
  });

  it('isolates discoverer errors gracefully', async () => {
    const discoverer: InstructionsDiscoverer = {
      discover: vi.fn().mockImplementation(() => {
        throw new Error('Discovery crashed');
      })
    };
    const hook = createInstructionsHook(discoverer);

    const result = await hook.handler(createPreModelCallEvent({ type: 'PreModelCall' }));

    expect(result).toEqual({ continue: true });
  });

  it('returns the correct id and priority', () => {
    const discoverer: InstructionsDiscoverer = { discover: vi.fn() };
    const hook = createInstructionsHook(discoverer);

    expect(hook.id).toBe('instructions:inject');
    expect(hook.priority).toBe(100);
  });
});
