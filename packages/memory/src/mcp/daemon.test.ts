import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { isDaemonRunning, getDaemonStatus } from './daemon.js';

describe('Daemon', () => {
  const testPidDir = join(tmpdir(), 'agentsy-memory-test-daemon');
  const testPidFile = join(testPidDir, 'test-daemon.pid');

  beforeEach(() => {
    mkdirSync(testPidDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (testPidFile) unlinkSync(testPidFile);
    } catch {
      // Ignore
    }
  });

  it('should report not running when no PID file exists', async () => {
    const running = await isDaemonRunning('/nonexistent/path.pid');
    expect(running).toBe(false);
  });

  it('should report not running when PID file contains invalid data', async () => {
    writeFileSync(testPidFile, 'not-a-number', 'utf-8');
    const running = await isDaemonRunning(testPidFile);
    expect(running).toBe(false);
  });

  it('should report not running when PID in file does not exist', async () => {
    writeFileSync(testPidFile, '999999999', 'utf-8');
    const running = await isDaemonRunning(testPidFile);
    expect(running).toBe(false);
  });

  it('should report running when current process PID is in file', async () => {
    writeFileSync(testPidFile, String(process.pid), 'utf-8');
    const running = await isDaemonRunning(testPidFile);
    expect(running).toBe(true);
  });

  it('getDaemonStatus returns null stats when not running', async () => {
    const status = await getDaemonStatus('/nonexistent/path.pid');
    expect(status.running).toBe(false);
    expect(status.pid).toBeNull();
    expect(status.uptime).toBeNull();
    expect(status.engineStats).toBeNull();
  });

  it('getDaemonStatus returns pid when running', async () => {
    writeFileSync(testPidFile, String(process.pid), 'utf-8');
    const status = await getDaemonStatus(testPidFile);
    expect(status.running).toBe(true);
    expect(status.pid).toBe(process.pid);
  });
});
