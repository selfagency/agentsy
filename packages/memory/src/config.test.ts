import { describe, expect, it } from 'vitest';

import { DEFAULT_TIER_CONFIGS, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('should return defaults when no overrides provided', () => {
    const config = loadConfig();
    expect(config.db.path).toBe('.agentsy/memory.db');
    expect(config.tiers).toEqual(DEFAULT_TIER_CONFIGS);
    expect(config.mcp.transport).toBe('stdio');
    expect(config.logLevel).toBe('info');
  });

  it('should override db path from env', () => {
    process.env.AGENTSY_MEMORY_DB = '/custom/path.db';
    const config = loadConfig();
    expect(config.db.path).toBe('/custom/path.db');
    delete process.env.AGENTSY_MEMORY_DB;
  });

  it('should override transport from env', () => {
    process.env.AGENTSY_MEMORY_TRANSPORT = 'http';
    const config = loadConfig();
    expect(config.mcp.transport).toBe('http');
    delete process.env.AGENTSY_MEMORY_TRANSPORT;
  });

  it('should override port from env', () => {
    process.env.AGENTSY_MEMORY_PORT = '9999';
    const config = loadConfig();
    expect(config.mcp.port).toBe(9999);
    delete process.env.AGENTSY_MEMORY_PORT;
  });

  it('should accept constructor overrides', () => {
    const config = loadConfig({
      db: { path: '/custom/path.db' },
      logLevel: 'debug'
    });
    expect(config.db.path).toBe('/custom/path.db');
    expect(config.logLevel).toBe('debug');
  });

  it('should have all 5 tier configs', () => {
    const config = loadConfig();
    const tierNames = Object.keys(config.tiers);
    expect(tierNames).toContain('sensory_buffer');
    expect(tierNames).toContain('sensory_register');
    expect(tierNames).toContain('working_memory');
    expect(tierNames).toContain('short_term_memory');
    expect(tierNames).toContain('long_term_memory');
  });

  it('should have hooks enabled by default', () => {
    const config = loadConfig();
    expect(config.hooks.onSessionStart).toBe(true);
    expect(config.hooks.onSessionEnd).toBe(true);
    expect(config.hooks.onToolCall).toBe(true);
    expect(config.hooks.onResponse).toBe(true);
  });

  it('should disable hooks via env', () => {
    process.env.AGENTSY_MEMORY_HOOK_SESSION_START = '0';
    const config = loadConfig();
    expect(config.hooks.onSessionStart).toBe(false);
    delete process.env.AGENTSY_MEMORY_HOOK_SESSION_START;
  });
});
