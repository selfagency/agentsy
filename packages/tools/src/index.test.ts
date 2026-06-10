import { describe, expect, it } from 'vitest';
import {
  createFsTools,
  createHttpTool,
  createMcpBridgeTool,
  createReplTool,
  createShellTool,
  registerBaselineTools,
  ToolRegistry
} from './index.js';

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const registry = new ToolRegistry();
    registry.register(createReplTool());
    expect(registry.get('repl_execute')).toBeDefined();
    expect(registry.size).toBe(1);
  });

  it('registers with name + handler overload', () => {
    const registry = new ToolRegistry();
    registry.register('custom_tool', async () => ({ ok: true, data: 'done' }));
    expect(registry.get('custom_tool')).toBeDefined();
  });

  it('lists all registered tools', () => {
    const registry = new ToolRegistry();
    registry.register(createReplTool());
    registry.register(createShellTool());
    expect(registry.list()).toHaveLength(2);
  });

  it('executes a tool and returns the result', async () => {
    const registry = new ToolRegistry();
    registry.register('echo', async input => ({
      ok: true,
      data: { echoed: input.message }
    }));
    const result = await registry.execute('echo', { message: 'hello' });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ echoed: 'hello' });
  });

  it('returns error for unknown tool', async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute('nonexistent', {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not found');
    expect(result.data).toBeNull();
  });

  it('returns error when handler throws', async () => {
    const registry = new ToolRegistry();
    registry.register('broken', async () => {
      throw new Error('kaboom');
    });
    const result = await registry.execute('broken', {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('kaboom');
  });

  it('removes a tool', () => {
    const registry = new ToolRegistry();
    registry.register(createReplTool());
    expect(registry.remove('repl_execute')).toBe(true);
    expect(registry.get('repl_execute')).toBeUndefined();
  });

  it('clears all tools', () => {
    const registry = new ToolRegistry();
    registry.register(createReplTool());
    registry.register(createShellTool());
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('lists tools by annotation key', () => {
    const registry = new ToolRegistry();
    registry.register(createReplTool());
    registry.register(createHttpTool());
    const destructive = registry.listByAnnotation('destructiveHint');
    expect(destructive).toHaveLength(1);
    expect(destructive[0]?.name).toBe('repl_execute');
    const openWorld = registry.listByAnnotation('openWorldHint');
    expect(openWorld).toHaveLength(1);
    expect(openWorld[0]?.name).toBe('http_fetch');
  });

  it('serializes to status JSON', () => {
    const registry = new ToolRegistry();
    registry.register(createReplTool());
    const json = registry.toJSON();
    expect(json).toHaveLength(1);
    expect(json[0]?.name).toBe('repl_execute');
    expect(json[0]?.enabled).toBe(true);
    expect(json[0]?.annotations).toBeDefined();
  });
});

describe('registerBaselineTools', () => {
  it('registers all 7 baseline tools', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.size).toBe(7);
  });

  it('includes repl_execute', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('repl_execute')).toBeDefined();
  });

  it('includes fs_read', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('fs_read')).toBeDefined();
  });

  it('includes fs_write', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('fs_write')).toBeDefined();
  });

  it('includes fs_patch', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('fs_patch')).toBeDefined();
  });

  it('includes shell_exec', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('shell_exec')).toBeDefined();
  });

  it('includes http_fetch', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('http_fetch')).toBeDefined();
  });

  it('includes mcp_call', () => {
    const registry = new ToolRegistry();
    registerBaselineTools(registry);
    expect(registry.get('mcp_call')).toBeDefined();
  });
});

describe('Baseline tool handlers', () => {
  it('repl_execute requires code parameter', async () => {
    const tool = createReplTool();
    const result = await tool.handler({});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('code');
  });

  it('repl_execute succeeds with code', async () => {
    const tool = createReplTool();
    const result = await tool.handler({ code: '1 + 1' });
    expect(result.ok).toBe(true);
  });

  it('fs_read requires path parameter', async () => {
    const tools = createFsTools();
    const readTool = tools.find(t => t.name === 'fs_read')!;
    const result = await readTool.handler({});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('path');
  });

  it('fs_read succeeds with path', async () => {
    const tools = createFsTools();
    const readTool = tools.find(t => t.name === 'fs_read')!;
    const result = await readTool.handler({ path: '/tmp/test.txt' });
    expect(result.ok).toBe(true);
  });

  it('fs_write requires path parameter', async () => {
    const tools = createFsTools();
    const writeTool = tools.find(t => t.name === 'fs_write')!;
    const result = await writeTool.handler({ content: 'data' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('path');
  });

  it('fs_write succeeds with path and content', async () => {
    const tools = createFsTools();
    const writeTool = tools.find(t => t.name === 'fs_write')!;
    const result = await writeTool.handler({ path: '/tmp/test.txt', content: 'hello' });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('written', true);
  });

  it('fs_patch requires path parameter', async () => {
    const tools = createFsTools();
    const patchTool = tools.find(t => t.name === 'fs_patch')!;
    const result = await patchTool.handler({ oldString: 'foo' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('path');
  });

  it('shell_exec requires command parameter', async () => {
    const tool = createShellTool();
    const result = await tool.handler({});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('command');
  });

  it('shell_exec succeeds with command', async () => {
    const tool = createShellTool();
    const result = await tool.handler({ command: 'echo hello' });
    expect(result.ok).toBe(true);
  });

  it('http_fetch requires url parameter', async () => {
    const tool = createHttpTool();
    const result = await tool.handler({});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('url');
  });

  it('http_fetch succeeds with url', async () => {
    const tool = createHttpTool();
    const result = await tool.handler({ url: 'https://example.com' });
    expect(result.ok).toBe(true);
  });

  it('mcp_call requires server and tool parameters', async () => {
    const tool = createMcpBridgeTool();
    const result = await tool.handler({ server: 'test' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('mcp_call succeeds with server and tool', async () => {
    const tool = createMcpBridgeTool();
    const result = await tool.handler({ server: 'test', tool: 'my_tool' });
    expect(result.ok).toBe(true);
  });
});
