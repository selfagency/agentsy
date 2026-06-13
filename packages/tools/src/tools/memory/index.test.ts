import { describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '../../definitions.js';
import { createMemoryTools, type MemoryToolProvider } from './index.js';

function makeProvider(): MemoryToolProvider {
  return {
    capture: vi.fn().mockResolvedValue({ id: 'mem-1' }),
    query: vi.fn().mockResolvedValue([{ content: 'relevant info', id: 'mem-1', score: 0.9, title: 'Info' }])
  };
}

function findTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Tool ${name} not found`);
  }
  return tool;
}

describe('memory_append', () => {
  it('stores a fact', async () => {
    const provider = makeProvider();
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_append');

    const result = await tool.handler({ type: 'entity', content: 'Dark mode preferred' });

    expect(result.ok).toBe(true);
    expect(provider.capture).toHaveBeenCalledWith({
      type: 'entity',
      content: 'Dark mode preferred',
      sessionId: 's1'
    });
  });

  it('returns error when type is missing', async () => {
    const tools = createMemoryTools({ memory: makeProvider(), sessionId: 's1' });
    const tool = findTool(tools, 'memory_append');

    const result = await tool.handler({ content: 'test' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('type');
  });

  it('returns error when content is missing', async () => {
    const tools = createMemoryTools({ memory: makeProvider(), sessionId: 's1' });
    const tool = findTool(tools, 'memory_append');

    const result = await tool.handler({ type: 'entity' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('content');
  });

  it('computes expiry from expiresAtDays', async () => {
    const provider = makeProvider();
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_append');

    await tool.handler({ type: 'entity', content: 'test', expiresAtDays: 7 });

    expect(provider.capture).toHaveBeenCalled();
    const call = vi.mocked(provider.capture).mock.calls[0];
    expect(call?.[0]?.expiresAt).toBeInstanceOf(Date);
  });

  it('isolates provider errors', async () => {
    const provider: MemoryToolProvider = {
      capture: vi.fn().mockRejectedValue(new Error('memory down')),
      query: vi.fn()
    };
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_append');

    const result = await tool.handler({ type: 'entity', content: 'test' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('memory_append error');
  });
});

describe('memory_search', () => {
  it('searches memory', async () => {
    const provider = makeProvider();
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_search');

    const result = await tool.handler({ query: 'dark mode' });

    expect(result.ok).toBe(true);
    expect(provider.query).toHaveBeenCalledWith({
      query: 'dark mode',
      limit: 5,
      minRelevance: 0.5,
      sessionId: 's1'
    });
  });

  it('returns error when query is missing', async () => {
    const tools = createMemoryTools({ memory: makeProvider(), sessionId: 's1' });
    const tool = findTool(tools, 'memory_search');

    const result = await tool.handler({});

    expect(result.ok).toBe(false);
    expect(result.error).toContain('query');
  });

  it('uses default limit of 5', async () => {
    const provider = makeProvider();
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_search');

    await tool.handler({ query: 'test' });

    expect(provider.query).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
  });

  it('accepts custom limit', async () => {
    const provider = makeProvider();
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_search');

    await tool.handler({ query: 'test', limit: 10 });

    expect(provider.query).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it('isolates provider errors', async () => {
    const provider: MemoryToolProvider = {
      capture: vi.fn(),
      query: vi.fn().mockRejectedValue(new Error('search down'))
    };
    const tools = createMemoryTools({ memory: provider, sessionId: 's1' });
    const tool = findTool(tools, 'memory_search');

    const result = await tool.handler({ query: 'test' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('memory_search error');
  });
});
