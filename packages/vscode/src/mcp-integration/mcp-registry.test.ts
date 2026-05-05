import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServerRegistry } from './mcp-server-registry.js';
import type { McpServerDefinition, McpServerProvider } from '../types/errors.js';

function makeServer(overrides: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return {
    name: 'test-server',
    command: 'node',
    args: ['./mcp-server.js'],
    ...overrides,
  };
}

describe('McpServerRegistry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('register adds a server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    const added = registry.register(makeServer());
    expect(added).toBe(true);
    expect(registry.has('test-server')).toBe(true);
  });

  it('register returns false for duplicate', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer());
    const second = registry.register(makeServer());
    expect(second).toBe(false);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('unregister removes a server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer());
    const removed = registry.unregister('test-server');
    expect(removed).toBe(true);
    expect(registry.has('test-server')).toBe(false);
  });

  it('unregister returns false for unknown server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    expect(registry.unregister('missing')).toBe(false);
  });

  it('get returns server definition', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    const server = makeServer({ name: 'myServer' });
    registry.register(server);
    expect(registry.get('myServer')).toEqual(server);
  });

  it('get returns undefined for unknown server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    expect(registry.get('nope')).toBeUndefined();
  });

  it('getAll returns all servers', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer({ name: 'a' }));
    registry.register(makeServer({ name: 'b' }));
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map(s => s.name)).toContain('a');
    expect(all.map(s => s.name)).toContain('b');
  });

  it('loadFromProviders populates servers from provider', async () => {
    const provider: McpServerProvider = {
      provide: vi
        .fn()
        .mockResolvedValue([makeServer({ name: 'prov-server-1' }), makeServer({ name: 'prov-server-2' })]),
    };
    const registry = new McpServerRegistry({
      namespace: 'ext.mcpServers',
      providers: [provider],
    });
    await registry.loadFromProviders();
    expect(registry.has('prov-server-1')).toBe(true);
    expect(registry.has('prov-server-2')).toBe(true);
  });

  it('loadFromProviders is a no-op with no providers', async () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    await expect(registry.loadFromProviders()).resolves.not.toThrow();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('activate loads providers and skips vscode registration when autoRegister is false', async () => {
    const provider: McpServerProvider = {
      provide: vi.fn().mockResolvedValue([makeServer({ name: 'loaded' })]),
    };
    const registry = new McpServerRegistry({
      namespace: 'ext.mcpServers',
      providers: [provider],
      autoRegister: false,
    });
    await registry.activate();
    expect(registry.has('loaded')).toBe(true);
  });

  it('registerWithVscode is a no-op when VS Code unavailable', async () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer());
    await expect(registry.registerWithVscode()).resolves.not.toThrow();
  });

  it('registerWithVscode serializes and writes server configuration without persisting secrets', async () => {
    vi.resetModules();
    const update = vi.fn(async () => undefined);
    const get = vi.fn(() => ({ existing: { command: 'existing-cmd' } }));

    vi.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => ({ get, update }),
      },
      ConfigurationTarget: {
        Workspace: 1,
      },
    }));

    const { McpServerRegistry: Registry } = await import('./mcp-server-registry.js');
    const registry = new Registry({ namespace: 'ext.mcpServers' });
    registry.register({
      name: 'zai-server',
      command: 'node',
      args: ['mcp.js'],
      env: { API_KEY: 'x' },
      headers: { Authorization: 'Bearer x' },
      alwaysAllow: true,
    });

    await registry.registerWithVscode();

    expect(get).toHaveBeenCalledWith('ext.mcpServers');
    expect(update).toHaveBeenCalledWith(
      'ext.mcpServers',
      expect.objectContaining({
        existing: { command: 'existing-cmd' },
        'zai-server': {
          command: 'node',
          args: ['mcp.js'],
          alwaysAllow: true,
        },
      }),
      1,
    );
  });

  it('dispose clears all servers', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer({ name: 'a' }));
    registry.register(makeServer({ name: 'b' }));
    registry.dispose();
    expect(registry.getAll()).toHaveLength(0);
  });
});
