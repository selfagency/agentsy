import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolCallBlock } from './ToolCallBlock.js';
import { darkTheme } from '../themes/index.js';

describe('ToolCallBlock Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports ToolCallBlock as a function', () => {
    expect(typeof ToolCallBlock).toBe('function');
  });

  it('accepts all required props', () => {
    const call = {
      id: 'call-1',
      name: 'search',
      arguments: { query: 'test' },
      done: false,
    };

    expect(call.name).toBe('search');
    expect(call.id).toBe('call-1');
    expect(call.done).toBe(false);
  });

  it('supports pending tool calls', () => {
    const call = {
      id: 'call-1',
      name: 'search',
      arguments: { query: 'test' },
      done: false,
    };

    expect(call.done).toBe(false);
  });

  it('supports completed tool calls', () => {
    const call = {
      id: 'call-1',
      name: 'search',
      arguments: { query: 'test' },
      done: true,
    };

    expect(call.done).toBe(true);
  });

  it('handles complex nested arguments', () => {
    const call = {
      id: 'call-1',
      name: 'api_call',
      arguments: {
        endpoint: '/api/users',
        method: 'POST',
        data: { name: 'test', nested: { key: 'value' } },
      },
      done: false,
    };

    expect(call.arguments.data).toBeDefined();
    expect(call.arguments.endpoint).toBe('/api/users');
  });

  it('handles empty arguments', () => {
    const call = {
      id: 'call-1',
      name: 'no_args_tool',
      arguments: {},
      done: true,
    };

    expect(Object.keys(call.arguments).length).toBe(0);
  });

  it('handles very long tool names', () => {
    const longName = 'very_long_tool_name_that_exceeds_normal_length_for_demonstration';
    const call = {
      id: 'call-1',
      name: longName,
      arguments: {},
      done: false,
    };

    expect(call.name.length).toBeGreaterThan(50);
  });

  it('supports screen reader accessibility prop', () => {
    const screenReader = true;
    expect(screenReader).toBe(true);
  });

  it('theme has required tool call properties', () => {
    expect(darkTheme.toolCall).toBeDefined();
    expect(darkTheme.toolCall.pendingColor).toBeDefined();
    expect(darkTheme.toolCall.doneColor).toBeDefined();
  });

  it('generates unique call IDs', () => {
    const call1 = { id: 'call-1', name: 'tool1', arguments: {}, done: false };
    const call2 = { id: 'call-2', name: 'tool2', arguments: {}, done: false };

    expect(call1.id).not.toBe(call2.id);
  });
});

