import { describe, expect, it, vi } from 'vitest';
import { createAgentFsAdapter, type AgentFsLike } from './agentfs-adapter.js';

describe('createAgentFsAdapter', () => {
  const mockManager = (): AgentFsLike => ({
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  });

  it('should handle successful read', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'test.txt' as any;

    vi.mocked(manager.read).mockReturnValue({ content: 'hello', contentHash: 'h1' });

    const result = adapter.read({ path });
    expect(result).toEqual({ ok: true, path, content: 'hello', contentHash: 'h1' });
  });

  it('should handle read failure for missing path', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'missing.txt' as any;

    vi.mocked(manager.read).mockReturnValue(undefined);

    const result = adapter.read({ path });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle successful write', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'new.txt' as any;

    vi.mocked(manager.write).mockReturnValue({ contentHash: 'h2' });

    const result = adapter.write({ path, content: 'world' });
    expect(result).toEqual({ ok: true, path, contentHash: 'h2' });
  });

  it('should handle write errors', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);

    vi.mocked(manager.write).mockImplementation(() => {
      throw new Error('write failed');
    });

    const result = adapter.write({ path: 'fail.txt' as any, content: '...' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('write failed');

    vi.mocked(manager.write).mockImplementation(() => {
      throw 'string error';
    });
    const result2 = adapter.write({ path: 'fail2.txt' as any, content: '...' });
    expect(result2.error).toBe('string error');
  });

  it('should handle successful delete', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'gone.txt' as any;

    vi.mocked(manager.delete).mockReturnValue(true);

    const result = adapter.delete({ path });
    expect(result.ok).toBe(true);
  });

  it('should handle delete failure', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'nonexistent.txt' as any;

    vi.mocked(manager.delete).mockReturnValue(false);

    const result = adapter.delete({ path });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle list', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const entries = [{ path: 'a.txt' as any, contentHash: 'ha' }];

    vi.mocked(manager.list).mockReturnValue(entries);

    const result = adapter.list();
    expect(result).toEqual({ ok: true, entries });
  });
});
