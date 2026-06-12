import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStore, getDefaultSessionFilePath } from './file-store.js';

describe('getDefaultSessionFilePath', () => {
  it('returns a string path', () => {
    const path = getDefaultSessionFilePath();
    expect(path).toBeTypeOf('string');
    expect(path).toContain('.agentsy');
  });
});

describe('createFileStore', () => {
  let testDir: string;
  let testPath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `agentsy-test-${Date.now()}`);
    testPath = join(testDir, 'test-sessions.json');
  });

  afterEach(() => {
    try {
      if (existsSync(testPath)) {
        unlinkSync(testPath);
      }
      if (existsSync(testDir)) {
        const files = [testPath];
        for (const f of files) {
          try {
            if (existsSync(f)) {
              unlinkSync(f);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore cleanup errors
    }
  });

  it('creates an empty store when file does not exist', () => {
    const store = createFileStore(testPath);
    expect(store.listKeys()).toHaveLength(0);
  });

  it('loads existing data from file', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testPath, JSON.stringify({ 'session:abc': { sessionId: 'abc' } }), 'utf-8');
    const store = createFileStore(testPath);
    expect(store.listKeys()).toContain('session:abc');
    expect(store.getValue('session:abc')).toEqual({ sessionId: 'abc' });
  });

  it('handles corrupted file gracefully', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testPath, 'not-json{', 'utf-8');
    const store = createFileStore(testPath);
    expect(store.listKeys()).toHaveLength(0);
  });

  it('handles empty file gracefully', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testPath, '', 'utf-8');
    const store = createFileStore(testPath);
    expect(store.listKeys()).toHaveLength(0);
  });

  it('setValue persists to disk', () => {
    const store = createFileStore(testPath);
    store.setValue('key1', 'value1');
    const raw = readFileSync(testPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.key1).toBe('value1');
  });

  it('getValue returns stored values', () => {
    const store = createFileStore(testPath);
    store.setValue('key1', 'value1');
    expect(store.getValue('key1')).toBe('value1');
  });

  it('getValue returns undefined for missing key', () => {
    const store = createFileStore(testPath);
    expect(store.getValue('nonexistent')).toBeUndefined();
  });

  it('listKeys returns all keys', () => {
    const store = createFileStore(testPath);
    store.setValue('a', 1);
    store.setValue('b', 2);
    const keys = store.listKeys();
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    expect(keys).toHaveLength(2);
  });

  it('removeValue deletes a key and persists', () => {
    const store = createFileStore(testPath);
    store.setValue('key1', 'value1');
    store.removeValue('key1');
    expect(store.getValue('key1')).toBeUndefined();
    expect(store.listKeys()).not.toContain('key1');
    const raw = readFileSync(testPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.key1).toBeUndefined();
  });

  it('removeValue is no-op for missing key', () => {
    const store = createFileStore(testPath);
    store.setValue('keep', 'me');
    store.removeValue('nonexistent');
    expect(store.getValue('keep')).toBe('me');
  });

  it('clear removes all keys and persists', () => {
    const store = createFileStore(testPath);
    store.setValue('a', 1);
    store.setValue('b', 2);
    store.clear();
    expect(store.listKeys()).toHaveLength(0);
    const raw = readFileSync(testPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual({});
  });

  it('getState returns all values', () => {
    const store = createFileStore(testPath);
    store.setValue('x', 10);
    const state = store.getState();
    expect(state.values.x).toBe(10);
  });

  it('reloads persisted data on new instance', () => {
    const store1 = createFileStore(testPath);
    store1.setValue('persist', 'yes');
    const store2 = createFileStore(testPath);
    expect(store2.getValue('persist')).toBe('yes');
  });

  it('uses default path when no path given', () => {
    const store = createFileStore();
    expect(store.listKeys()).toBeDefined();
  });
});
