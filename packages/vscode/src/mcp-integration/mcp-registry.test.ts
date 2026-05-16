import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpServerDefinition, McpServerProvider } from '../types/errors.js';
import { McpServerRegistry } from './mcp-server-registry.js';

function makeServer(overrides: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return {
    args: ['./mcp-server.js'],
    command: 'node',
    name: 'test-server',
    ...overrides
  };
}

describe(McpServerRegistry, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('register adds a server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    const added = registry.register(makeServer());
    expect(added).toBeTruthy();
    expect(registry.has('test-server')).toBeTruthy();
  });

  it('register returns false for duplicate', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer());
    const second = registry.register(makeServer());
    expect(second).toBeFalsy();
    expect(registry.getAll()).toHaveLength(1);
  });

  it('unregister removes a server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer());
    const removed = registry.unregister('test-server');
    expect(removed).toBeTruthy();
    expect(registry.has('test-server')).toBeFalsy();
  });

  it('unregister returns false for unknown server', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    expect(registry.unregister('missing')).toBeFalsy();
  });

  it('get returns server definition', () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    const server = makeServer({ name: 'myServer' });
    registry.register(server);
    expect(registry.get('myServer')).toStrictEqual(server);
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
      provide: vi.fn().mockResolvedValue([makeServer({ name: 'prov-server-1' }), makeServer({ name: 'prov-server-2' })])
    };
    const registry = new McpServerRegistry({
      namespace: 'ext.mcpServers',
      providers: [provider]
    });
    await registry.loadFromProviders();
    expect(registry.has('prov-server-1')).toBeTruthy();
    expect(registry.has('prov-server-2')).toBeTruthy();
  });

  it('loadFromProviders is a no-op with no providers', async () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    await expect(registry.loadFromProviders()).resolves.not.toThrow();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('activate loads providers and skips vscode registration when autoRegister is false', async () => {
    const provider: McpServerProvider = {
      provide: vi.fn().mockResolvedValue([makeServer({ name: 'loaded' })])
    };
    const registry = new McpServerRegistry({
      autoRegister: false,
      namespace: 'ext.mcpServers',
      providers: [provider]
    });
    await registry.activate();
    expect(registry.has('loaded')).toBeTruthy();
  });

  it('registerWithVscode is a no-op when VS Code unavailable', async () => {
    const registry = new McpServerRegistry({ namespace: 'ext.mcpServers' });
    registry.register(makeServer());
    await expect(registry.registerWithVscode()).resolves.not.toThrow();
  });

  it('registerWithVscode serializes and writes server configuration without persisting secrets', async () => {
    vi.resetModules();
    const update = vi.fn(async () => {});
    const get = vi.fn(() => ({ existing: { command: 'existing-cmd' } }));

    vi.doMock(import('vscode'), () => ({
      ConfigurationTarget: {
        Workspace: 1
      },
      workspace: {
        getConfiguration: () => ({ get, update })
      }
    }));

    const { McpServerRegistry: Registry } = await import('./mcp-server-registry.js');
    const registry = new Registry({ namespace: 'ext.mcpServers' });
    registry.register({
      alwaysAllow: true,
      args: ['mcp.js'],
      command: 'node',
      env: { API_KEY: 'x' },
      headers: { Authorization: 'Bearer x' },
      name: 'zai-server'
    });

    await registry.registerWithVscode();

    expect(get).toHaveBeenCalledWith('ext.mcpServers');
    expect(update).toHaveBeenCalledWith(
      'ext.mcpServers',
      expect.objectContaining({
        existing: { command: 'existing-cmd' },
        'zai-server': {
          alwaysAllow: true,
          args: ['mcp.js'],
          command: 'node'
        }
      }),
      1
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
