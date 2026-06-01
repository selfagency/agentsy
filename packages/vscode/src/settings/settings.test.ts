import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsSchema } from './schema-validator.js';
import { applyDefaults, validateSettings } from './schema-validator.js';
import { SettingsLoader } from './settings-loader.js';

// --- Schema Validator Tests ---

describe('validateSettings', () => {
  it('returns valid for empty schema', () => {
    const result = validateSettings({ key: 'value' }, {});
    expect(result.valid).toBe(true);
  });

  it('reports missing required fields', () => {
    const schema: SettingsSchema = { required: ['host', 'port'] };
    const result = validateSettings({ host: 'localhost' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required setting: 'port'");
  });

  it('validates type mismatch', () => {
    const schema: SettingsSchema = {
      properties: { port: { type: 'number' } }
    };
    const result = validateSettings({ port: 'not-a-number' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain("'port' must be of type 'number'");
  });

  it('validates enum values', () => {
    const schema: SettingsSchema = {
      properties: { level: { type: 'string', enum: ['debug', 'info', 'error'] } }
    };
    expect(validateSettings({ level: 'info' }, schema).valid).toBe(true);
    const bad = validateSettings({ level: 'verbose' }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors?.[0]).toContain('one of: debug, info, error');
  });

  it('validates number minimum', () => {
    const schema: SettingsSchema = {
      properties: { port: { type: 'number', minimum: 1, maximum: 65535 } }
    };
    expect(validateSettings({ port: 80 }, schema).valid).toBe(true);
    expect(validateSettings({ port: 0 }, schema).valid).toBe(false);
    expect(validateSettings({ port: 70000 }, schema).valid).toBe(false);
  });

  it('skips validation for absent optional fields', () => {
    const schema: SettingsSchema = {
      properties: { port: { type: 'number' } }
    };
    const result = validateSettings({}, schema);
    expect(result.valid).toBe(true);
  });

  it('returns valid with no errors array when valid', () => {
    const schema: SettingsSchema = { required: ['host'] };
    const result = validateSettings({ host: 'localhost' }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});

describe('applyDefaults', () => {
  it('merges defaults with settings', () => {
    const defaults = { host: 'localhost', port: 11434, debug: false };
    const settings = { port: 8080 };
    const result = applyDefaults(settings, defaults);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(8080);
    expect(result.debug).toBe(false);
  });

  it('settings override defaults', () => {
    const result = applyDefaults({ key: 'custom' }, { key: 'default' });
    expect(result.key).toBe('custom');
  });

  it('ignores null/undefined settings (uses default)', () => {
    const result = applyDefaults({ key: null } as Record<string, unknown>, { key: 'fallback' });
    expect(result.key).toBe('fallback');
  });
});

// --- SettingsLoader Tests ---

describe('SettingsLoader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads defaults when VS Code unavailable', async () => {
    const loader = new SettingsLoader({
      namespace: 'myExt',
      schema: { properties: { host: { type: 'string' } } },
      defaults: { host: 'localhost', port: 11434 }
    });
    const settings = await loader.load();
    expect(settings.host).toBe('localhost');
    expect(settings.port).toBe(11434);
  });

  it('validate returns valid for conforming settings', () => {
    const loader = new SettingsLoader({
      namespace: 'myExt',
      schema: {
        required: ['host'],
        properties: { host: { type: 'string' }, port: { type: 'number' } }
      }
    });
    const result = loader.validate({ host: 'localhost', port: 80 });
    expect(result.valid).toBe(true);
  });

  it('validate returns errors for invalid settings', () => {
    const loader = new SettingsLoader({
      namespace: 'myExt',
      schema: { required: ['host'] }
    });
    const result = loader.validate({ port: 80 });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('get returns undefined before load', () => {
    const loader = new SettingsLoader({ namespace: 'myExt', schema: {} });
    expect(loader.get('key')).toBeUndefined();
  });

  it('get returns fallback when key not in cache', () => {
    const loader = new SettingsLoader({ namespace: 'myExt', schema: {} });
    expect(loader.get('key', 'fallback')).toBe('fallback');
  });

  it('get returns value after load', async () => {
    const loader = new SettingsLoader({
      namespace: 'myExt',
      schema: {},
      defaults: { myKey: 'myValue' }
    });
    await loader.load();
    expect(loader.get('myKey')).toBe('myValue');
  });

  it('onDidChange registers and triggers listener', async () => {
    const loader = new SettingsLoader({
      namespace: 'myExt',
      schema: { properties: { port: { type: 'number' } } },
      defaults: { port: 80 }
    });
    await loader.load();

    const events: unknown[] = [];
    loader.onDidChange(e => events.push(e));

    // Simulate internal change notification
    const notifyListeners = (
      loader as unknown as { notifyListeners(o: Record<string, unknown>, n: Record<string, unknown>): void }
    ).notifyListeners?.bind(loader);
    if (notifyListeners) {
      notifyListeners({ port: 80 }, { port: 443 });
    }

    expect(events).toHaveLength(1);
    const event = events[0] as { key: string; oldValue: number; newValue: number };
    expect(event.key).toBe('port');
    expect(event.oldValue).toBe(80);
    expect(event.newValue).toBe(443);
  });

  it('dispose removes listeners', () => {
    const loader = new SettingsLoader({ namespace: 'myExt', schema: {} });
    const listener = vi.fn();
    const disposable = loader.onDidChange(listener);
    disposable.dispose();

    const notifyListeners = (
      loader as unknown as { notifyListeners(o: Record<string, unknown>, n: Record<string, unknown>): void }
    ).notifyListeners?.bind(loader);
    if (notifyListeners) {
      notifyListeners({ key: 'old' }, { key: 'new' });
    }
    expect(listener).not.toHaveBeenCalled();
  });

  it('watch is a no-op when vscode unavailable', async () => {
    const loader = new SettingsLoader({ namespace: 'myExt', schema: {} });
    await expect(loader.watch()).resolves.not.toThrow();
  });

  it('dispose does not throw', () => {
    const loader = new SettingsLoader({ namespace: 'myExt', schema: {} });
    expect(() => loader.dispose()).not.toThrow();
  });

  it('load without schema skips validation', async () => {
    const loader = new SettingsLoader({
      namespace: 'myExt',
      schema: {},
      defaults: { x: 1 }
    });
    const settings = await loader.load();
    expect(settings.x).toBe(1);
  });
});
