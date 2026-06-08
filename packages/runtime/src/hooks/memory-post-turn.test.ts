import { describe, expect, it, vi } from 'vitest';
import { createMemoryPostTurnHook, extractObservations } from './memory-post-turn.js';
import type { RuntimeHookEvent } from './types.js';

function createPostResponseEvent(response: unknown, overrides?: Partial<RuntimeHookEvent>): RuntimeHookEvent {
  return {
    ...overrides,
    response,
    sessionId: 'sess_1',
    type: 'PostResponse'
  };
}

function createNonPostResponseEvent(type: RuntimeHookEvent['type']): RuntimeHookEvent {
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

describe('extractObservations', () => {
  it('returns single observation from string response', () => {
    expect(extractObservations('hello world')).toEqual(['hello world']);
  });

  it('returns empty array for empty string', () => {
    expect(extractObservations('')).toEqual([]);
  });

  it('extracts content field from object', () => {
    expect(extractObservations({ content: 'observed content' })).toEqual(['observed content']);
  });

  it('extracts text field from object', () => {
    expect(extractObservations({ text: 'observed text' })).toEqual(['observed text']);
  });

  it('prefers content over text when both present', () => {
    expect(extractObservations({ content: 'content wins', text: 'text ignored' })).toEqual(['content wins']);
  });

  it('serializes object without content/text fields', () => {
    expect(extractObservations({ key: 'value', count: 42 })).toEqual(['{"key":"value","count":42}']);
  });

  it('returns empty for null response', () => {
    expect(extractObservations(null)).toEqual([]);
  });

  it('returns empty for undefined response', () => {
    expect(extractObservations(undefined)).toEqual([]);
  });

  it('returns empty for empty object', () => {
    expect(extractObservations({})).toEqual([]);
  });

  it('returns empty for empty content field', () => {
    expect(extractObservations({ content: '' })).toEqual([]);
  });

  it('returns empty for empty text field', () => {
    expect(extractObservations({ text: '' })).toEqual([]);
  });

  it('returns empty for numeric response', () => {
    expect(extractObservations(42)).toEqual([]);
  });
});

describe('createMemoryPostTurnHook', () => {
  it('captures observations from a PostResponse event', async () => {
    const memory = { capture: vi.fn().mockResolvedValue(undefined) };
    const hook = createMemoryPostTurnHook({ memory });
    const event = createPostResponseEvent('some observed content');

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(memory.capture).toHaveBeenCalledWith({
      observations: ['some observed content'],
      sessionId: 'sess_1'
    });
  });

  it('captures observations from object response with content field', async () => {
    const memory = { capture: vi.fn().mockResolvedValue(undefined) };
    const hook = createMemoryPostTurnHook({ memory });
    const event = createPostResponseEvent({ content: 'important fact' });

    await hook.handler(event);

    expect(memory.capture).toHaveBeenCalledWith({
      observations: ['important fact'],
      sessionId: 'sess_1'
    });
  });

  it('does not capture when response has no extractable observations', async () => {
    const memory = { capture: vi.fn() };
    const hook = createMemoryPostTurnHook({ memory });
    const event = createPostResponseEvent('');

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(memory.capture).not.toHaveBeenCalled();
  });

  it('skips non-PostResponse events', async () => {
    const memory = { capture: vi.fn() };
    const hook = createMemoryPostTurnHook({ memory });
    const event = createNonPostResponseEvent('PreToolCall');

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(memory.capture).not.toHaveBeenCalled();
  });

  it('isolates capture errors gracefully', async () => {
    const memory = {
      capture: vi.fn().mockRejectedValue(new Error('Capture failed'))
    };
    const hook = createMemoryPostTurnHook({ memory });
    const event = createPostResponseEvent('some content');

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
  });

  it('returns the correct id and priority', () => {
    const memory = { capture: vi.fn() };
    const hook = createMemoryPostTurnHook({ memory });

    expect(hook.id).toBe('memory:post-turn');
    expect(hook.priority).toBe(100);
  });
});
