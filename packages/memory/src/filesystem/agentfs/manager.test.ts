import { afterEach, describe, expect, it } from 'vitest';
import { __globalStoreForTests, createAgentFsManager } from './manager.js';

describe('createAgentFsManager', () => {
  afterEach(() => {
    __globalStoreForTests.clear();
  });

  it('defaults namespace to "default"', () => {
    const mgr = createAgentFsManager();
    expect(mgr.namespace).toBe('default');
  });

  it('uses provided namespace', () => {
    const mgr = createAgentFsManager({ namespace: 'test-ns' });
    expect(mgr.namespace).toBe('test-ns');
  });

  it('writes and reads an entry', () => {
    const mgr = createAgentFsManager();
    const entry = mgr.write('/a.txt', 'hello');
    expect(entry.path).toBe('/a.txt');
    expect(entry.content).toBe('hello');
    expect(entry.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(mgr.read('/a.txt')).toEqual(entry);
  });

  it('returns undefined for missing path', () => {
    const mgr = createAgentFsManager();
    expect(mgr.read('/missing.txt')).toBeUndefined();
  });

  it('preserves createdAt on overwrite', () => {
    const mgr = createAgentFsManager();
    const first = mgr.write('/file.txt', 'v1');
    const second = mgr.write('/file.txt', 'v2');
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.content).toBe('v2');
    expect(second.contentHash).not.toBe(first.contentHash);
  });

  it('content hash changes with content change', () => {
    const mgr = createAgentFsManager();
    const a = mgr.write('/x', 'aaa');
    const b = mgr.write('/x', 'bbb');
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('deletes an entry', () => {
    const mgr = createAgentFsManager();
    mgr.write('/del.txt', 'bye');
    expect(mgr.delete('/del.txt')).toBe(true);
    expect(mgr.read('/del.txt')).toBeUndefined();
  });

  it('returns false when deleting non-existent path', () => {
    const mgr = createAgentFsManager();
    expect(mgr.delete('/ghost.txt')).toBe(false);
  });

  it('lists all entries', () => {
    const mgr = createAgentFsManager();
    mgr.write('/a', 'a');
    mgr.write('/b', 'b');
    const paths = mgr
      .list()
      .map(e => e.path)
      .sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(['/a', '/b']);
  });

  it('has() returns correct values', () => {
    const mgr = createAgentFsManager();
    mgr.write('/c', 'c');
    expect(mgr.has('/c')).toBe(true);
    expect(mgr.has('/missing')).toBe(false);
  });

  it('clear() removes all entries', () => {
    const mgr = createAgentFsManager();
    mgr.write('/x', '1');
    mgr.write('/y', '2');
    mgr.clear();
    expect(mgr.list()).toHaveLength(0);
  });
});
