import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSourceConnectors } from './source-connectors.js';

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn()
}));
vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile
}));

describe('source connectors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks web fetch for hosts outside allowlist', async () => {
    const connectors = createSourceConnectors({
      web: {
        allowHosts: ['docs.example.com'],
        enabled: true
      }
    });

    await expect(connectors.fetchWebSource('https://evil.example.net/attack')).rejects.toThrow('allowlist');
  });

  it('throws when web connector is disabled', async () => {
    const connectors = createSourceConnectors({
      web: { enabled: false, allowHosts: ['docs.example.com'] }
    });

    await expect(connectors.fetchWebSource('https://docs.example.com/doc')).rejects.toThrow('disabled');
  });

  it('throws when web config is not provided', async () => {
    const connectors = createSourceConnectors({});

    await expect(connectors.fetchWebSource('https://docs.example.com/doc')).rejects.toThrow('disabled');
  });

  it('fetches web source successfully when host is allowed', async () => {
    const mockText = 'response body';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockText)
      })
    );

    const connectors = createSourceConnectors({
      web: { enabled: true, allowHosts: ['docs.example.com'] }
    });

    const result = await connectors.fetchWebSource('https://docs.example.com/doc');
    expect(result).toBe(mockText);

    vi.unstubAllGlobals();
  });

  it('reads local file with readFile', async () => {
    mockReadFile.mockResolvedValue('file content');

    const connectors = createSourceConnectors({});
    const result = await connectors.readLocalFile('/path/to/file.md');

    expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.md', 'utf-8');
    expect(result).toBe('file content');
  });
});
