import { describe, expect, it, vi } from 'vitest';
import type { MemoryItem } from './memory-pre-turn.js';
import { createMemoryPreTurnHook } from './memory-pre-turn.js';
import type { HookResult, RuntimeHookEvent } from './types.js';

function createUserPromptEvent(overrides: Partial<RuntimeHookEvent> & { type: 'UserPromptSubmit' }): RuntimeHookEvent {
  return {
    ...overrides,
    input: 'hello world',
    sessionId: 'sess_1'
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

function makeMemoryItems(count: number): readonly MemoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    content: `memory content ${i + 1}`,
    id: `mem_${i + 1}`,
    scope: 'session',
    score: 0.9 - i * 0.1,
    title: `Memory ${i + 1}`
  }));
}

describe('createMemoryPreTurnHook', () => {
  it('returns continue:true and no transform when memory returns empty', async () => {
    const memory = { retrieve: vi.fn().mockResolvedValue([]) };
    const hook = createMemoryPreTurnHook({ memory });
    const event = createUserPromptEvent({ type: 'UserPromptSubmit' });

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(memory.retrieve).toHaveBeenCalledWith({
      sessionId: 'sess_1',
      limit: 10,
      minRelevance: 0.6
    });
  });

  it('returns transform with memory context XML when memories match', async () => {
    const items = makeMemoryItems(2);
    const memory = { retrieve: vi.fn().mockResolvedValue(items) };
    const hook = createMemoryPreTurnHook({ memory });
    const event = createUserPromptEvent({ type: 'UserPromptSubmit' });

    const result = await hook.handler(event);

    expect('transform' in result).toBe(true);
    const xml = (result as Extract<HookResult, { transform: unknown }>).transform as string;
    expect(xml).toContain('<memory_context>');
    expect(xml).toContain('memory_item id="mem_1"');
    expect(xml).toContain('memory_item id="mem_2"');
    expect(xml).toContain('<title>Memory 1</title>');
    expect(xml).toContain('<content>memory content 1</content>');
  });

  it('respects custom maxItems option', async () => {
    const items = makeMemoryItems(5);
    const memory = { retrieve: vi.fn().mockResolvedValue(items) };
    const hook = createMemoryPreTurnHook({ memory, maxItems: 3 });

    await hook.handler(createUserPromptEvent({ type: 'UserPromptSubmit' }));

    expect(memory.retrieve).toHaveBeenCalledWith({
      sessionId: 'sess_1',
      limit: 3,
      minRelevance: 0.6
    });
  });

  it('skips non-UserPromptSubmit events', async () => {
    const memory = { retrieve: vi.fn() };
    const hook = createMemoryPreTurnHook({ memory });
    const event = createNonUserPromptEvent('PreToolCall');

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(memory.retrieve).not.toHaveBeenCalled();
  });

  it('isolates provider errors gracefully', async () => {
    const memory = {
      retrieve: vi.fn().mockRejectedValue(new Error('Provider unavailable'))
    };
    const hook = createMemoryPreTurnHook({ memory });
    const event = createUserPromptEvent({ type: 'UserPromptSubmit' });

    const result = await hook.handler(event);

    // Errors must not propagate — hook chain continues
    expect(result).toEqual({ continue: true });
  });

  it('returns the correct id and priority', () => {
    const memory = { retrieve: vi.fn() };
    const hook = createMemoryPreTurnHook({ memory });

    expect(hook.id).toBe('memory:pre-turn');
    expect(hook.priority).toBe(100);
  });

  it('escapes XML in memory content and title', async () => {
    const items: readonly MemoryItem[] = [
      {
        content: 'text with <script>alert("xss")</script> & more',
        id: 'mem_xss',
        scope: 'session',
        score: 0.95,
        title: 'Title with <evil> & quotes'
      }
    ];
    const memory = { retrieve: vi.fn().mockResolvedValue(items) };
    const hook = createMemoryPreTurnHook({ memory });
    const event = createUserPromptEvent({ type: 'UserPromptSubmit' });

    const result = await hook.handler(event);
    const xml = (result as Extract<HookResult, { transform: unknown }>).transform as string;

    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
    expect(xml).toContain('&lt;evil&gt;');
    expect(xml).toContain('&amp;');
  });

  it('clamps maxItems floor to 1', async () => {
    const memory = { retrieve: vi.fn().mockResolvedValue([]) };
    const hook = createMemoryPreTurnHook({ memory, maxItems: 0 });

    await hook.handler(createUserPromptEvent({ type: 'UserPromptSubmit' }));

    expect(memory.retrieve).toHaveBeenCalledWith(expect.objectContaining({ limit: expect.any(Number) }));
  });
});
