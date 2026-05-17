import type { PathLike } from 'node:fs';
import { accessSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectContainerRuntime } from './container-detector.js';

vi.mock('node:fs', () => ({
  accessSync: vi.fn(),
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  }
}));

describe('detectContainerRuntime', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('HOME', '/home/user');
    vi.stubEnv('XDG_RUNTIME_DIR', '/run/user/1000');
  });

  it('should detect docker socket in standard path', () => {
    vi.mocked(accessSync).mockImplementation((path: PathLike) => {
      if (path === '/var/run/docker.sock') {
        return;
      }
      throw new Error('Not found');
    });

    const result = detectContainerRuntime();
    expect(result.available).toBeTruthy();
    expect(result.runtime).toBe('docker');
    expect(result.socketPath).toBe('/var/run/docker.sock');
  });

  it('should detect podman socket', () => {
    vi.mocked(accessSync).mockImplementation((path: PathLike) => {
      if (path === '/run/podman/podman.sock') {
        return;
      }
      throw new Error('Not found');
    });

    const result = detectContainerRuntime();
    expect(result.available).toBeTruthy();
    expect(result.runtime).toBe('podman');
    expect(result.socketPath).toBe('/run/podman/podman.sock');
  });

  it('should return none if no sockets are found', () => {
    vi.mocked(accessSync).mockImplementation(() => {
      throw new Error('Not found');
    });

    const result = detectContainerRuntime();
    expect(result.available).toBeFalsy();
    expect(result.runtime).toBe('none');
  });

  it('should handle mac-specific docker socket path', () => {
    vi.stubEnv('HOME', '/home/user');
    vi.mocked(accessSync).mockImplementation((path: string | Buffer | URL) => {
      // In container-detector.ts, the path is built as:
      // `${process.env['HOME']}/Library/Containers/com.docker.docker/Data/docker.raw.sock`
      if (path === '/home/user/Library/Containers/com.docker.docker/Data/docker.raw.sock') {
        return;
      }
      throw new Error('Not found');
    });

    const result = detectContainerRuntime();
    expect(result.available).toBeTruthy();
    expect(result.runtime).toBe('docker');
    expect(result.socketPath).toContain('docker.raw.sock');
  });
});
