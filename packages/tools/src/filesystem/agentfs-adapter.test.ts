import { describe, expect, it, vi } from 'vitest';

import type { AgentFsLike } from './agentfs-adapter.js';
import { createAgentFsAdapter } from './agentfs-adapter.js';

describe('createAgentFsAdapter', () => {
  const mockManager = (): AgentFsLike => ({
    delete: vi.fn<(path: string) => boolean>(),
    list: vi.fn<() => { path: string; contentHash: string }[]>(),
    read: vi.fn<(path: string) => { content: string; contentHash: string } | undefined>(),
    write: vi.fn<(path: string, content: string) => { contentHash: string }>()
  });

  it('should handle successful read', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'test.txt';

    vi.mocked(manager.read).mockReturnValue({
      content: 'hello',
      contentHash: 'h1'
    });

    const result = adapter.read({ path });
    expect(result).toStrictEqual({
      content: 'hello',
      contentHash: 'h1',
      ok: true,
      path
    });
  });

  it('should handle read failure for missing path', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'missing.txt';

    vi.mocked(manager.read).mockClear();

    const result = adapter.read({ path });
    expect(result.ok).toBeFalsy();
    expect(result.error).toContain('not found');
  });

  it('should handle successful write', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'new.txt';

    vi.mocked(manager.write).mockReturnValue({ contentHash: 'h2' });

    const result = adapter.write({ content: 'world', path });
    expect(result).toStrictEqual({ contentHash: 'h2', ok: true, path });
  });

  it('should handle write errors', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);

    vi.mocked(manager.write).mockImplementation(() => {
      throw new Error('write failed');
    });

    const result = adapter.write({ content: '...', path: 'fail.txt' });
    expect(result.ok).toBeFalsy();
    expect(result.error).toBe('write failed');

    vi.mocked(manager.write).mockImplementation(() => {
      throw new Error('string error');
    });
    const result2 = adapter.write({ content: '...', path: 'fail2.txt' });
    expect(result2.error).toBe('string error');
  });

  it('should handle successful delete', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'gone.txt';

    vi.mocked(manager.delete).mockReturnValue(true);

    const result = adapter.delete({ path });
    expect(result.ok).toBeTruthy();
  });

  it('should handle delete failure', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const path = 'nonexistent.txt';

    vi.mocked(manager.delete).mockReturnValue(false);

    const result = adapter.delete({ path });
    expect(result.ok).toBeFalsy();
    expect(result.error).toContain('not found');
  });

  it('should handle list', () => {
    const manager = mockManager();
    const adapter = createAgentFsAdapter(manager);
    const entries = [{ contentHash: 'ha', path: 'a.txt' }];

    vi.mocked(manager.list).mockReturnValue(entries);

    const result = adapter.list();
    expect(result).toStrictEqual({ entries, ok: true });
  });
});
