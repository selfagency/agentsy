import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external modules that startDaemon/stopDaemon use internally
vi.mock('../config.js', () => ({ loadConfig: vi.fn() }));
vi.mock('../cognitive/memory-engine.js', () => ({ createMemoryEngine: vi.fn() }));
vi.mock('./server.js', () => ({ createMemoryMCPServer: vi.fn() }));

import { createMemoryEngine } from '../cognitive/memory-engine.js';
// These imports get the mocked versions because vi.mock is hoisted
import { loadConfig } from '../config.js';
import {
  buildDaemonConfig,
  cleanOldRestartTimestamps,
  getDaemonStatus,
  isDaemonRunning,
  startDaemon,
  stopDaemon
} from './daemon.js';
import { createMemoryMCPServer } from './server.js';

describe('Daemon', () => {
  const testPidDir = join(tmpdir(), 'agentsy-memory-test-daemon');
  const testPidFile = join(testPidDir, 'test-daemon.pid');

  beforeEach(() => {
    vi.clearAllMocks();
    mkdirSync(testPidDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up PID file
    try {
      unlinkSync(testPidFile);
    } catch {
      // Ignore
    }
    // Clean up any signal handlers that startDaemon may have registered
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    // Restore any spies (e.g. process.kill) to prevent cross-test contamination
    vi.restoreAllMocks();
  });

  /* ── isDaemonRunning ── */

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

  /* ── getDaemonStatus ── */

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

  /* ── buildDaemonConfig ── */

  it('buildDaemonConfig uses defaults when empty config given', () => {
    const config = buildDaemonConfig({});
    expect(config.pidFile).toBe('.agentsy/memory-daemon.pid');
    expect(config.logFile).toBe('.agentsy/memory-daemon.log');
    expect(config.restart).toBe(true);
    expect(config.restartDelay).toBe(1000);
    expect(config.maxRestarts).toBe(5);
    expect(config.restartWindow).toBe(60_000);
  });

  it('buildDaemonConfig merges partial overrides', () => {
    const config = buildDaemonConfig({ maxRestarts: 3, restartDelay: 500 });
    expect(config.maxRestarts).toBe(3);
    expect(config.restartDelay).toBe(500);
    expect(config.pidFile).toBe('.agentsy/memory-daemon.pid'); // default preserved
  });

  /* ── cleanOldRestartTimestamps ── */

  it('cleanOldRestartTimestamps removes timestamps outside the window', () => {
    const now = 1000;
    const timestamps = [100, 200, 500, 700, 900];
    cleanOldRestartTimestamps(timestamps, now, 500);
    expect(timestamps).toStrictEqual([500, 700, 900]);
  });

  it('cleanOldRestartTimestamps keeps all when within window', () => {
    const now = 1000;
    const timestamps = [600, 700, 800];
    cleanOldRestartTimestamps(timestamps, now, 500);
    expect(timestamps).toStrictEqual([600, 700, 800]);
  });

  it('cleanOldRestartTimestamps handles empty array', () => {
    const timestamps: number[] = [];
    cleanOldRestartTimestamps(timestamps, 1000, 500);
    expect(timestamps).toStrictEqual([]);
  });

  /* ── startDaemon ── */

  describe('startDaemon', () => {
    it('throws when daemon is already running', async () => {
      writeFileSync(testPidFile, String(process.pid), 'utf-8');

      await expect(startDaemon({}, { pidFile: testPidFile })).rejects.toThrow('already running');
    });

    it('starts successfully, writes PID file, and calls all dependencies', async () => {
      // Arrange: configure mocks for successful startup
      const mockMcpConfig = { logLevel: 'debug' as const, transport: 'stdio' as const };
      vi.mocked(loadConfig).mockReturnValue({ mcp: mockMcpConfig });

      const mockEngine = { stats: vi.fn(), ingest: vi.fn(), recall: vi.fn() };
      vi.mocked(createMemoryEngine).mockReturnValue(mockEngine);

      const mockStart = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createMemoryMCPServer).mockReturnValue({
        start: mockStart,
        close: mockClose,
        server: {}
      } as any);

      // Act
      await startDaemon({ dbPath: 'test-data/agentsy-daemon.db' }, { pidFile: testPidFile });

      // Assert: PID file was written with the correct PID
      expect(existsSync(testPidFile)).toBe(true);
      const pidContent = readFileSync(testPidFile, 'utf-8').trim();
      expect(pidContent).toBe(String(process.pid));

      // Assert: dependencies were called correctly
      expect(loadConfig).toHaveBeenCalledOnce();

      expect(createMemoryEngine).toHaveBeenCalledOnce();
      // engineOptions was not passed, so it defaults to undefined
      expect(createMemoryEngine).toHaveBeenCalledWith(undefined);

      expect(createMemoryMCPServer).toHaveBeenCalledOnce();
      expect(createMemoryMCPServer).toHaveBeenCalledWith(
        mockEngine,
        expect.objectContaining({
          dbPath: 'test-data/agentsy-daemon.db',
          logLevel: 'debug',
          transport: 'stdio'
        })
      );

      expect(mockStart).toHaveBeenCalledOnce();
    });

    it('starts successfully with engine options passed through', async () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValue({ mcp: {} });

      const mockEngine = { stats: vi.fn(), ingest: vi.fn(), recall: vi.fn() };
      vi.mocked(createMemoryEngine).mockReturnValue(mockEngine);

      const mockStart = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createMemoryMCPServer).mockReturnValue({
        start: mockStart,
        close: mockClose,
        server: {}
      } as any);

      const engineOptions = { logLevel: 'debug' as const };

      // Act
      await startDaemon({}, { pidFile: testPidFile }, engineOptions);

      // Assert: engineOptions was passed to createMemoryEngine
      expect(createMemoryEngine).toHaveBeenCalledWith(engineOptions);
      expect(mockStart).toHaveBeenCalledOnce();
    });

    it('re-throws error when restart is disabled', async () => {
      // Arrange
      vi.mocked(loadConfig).mockReturnValue({ mcp: {} });

      const mockEngine = { stats: vi.fn(), ingest: vi.fn(), recall: vi.fn() };
      vi.mocked(createMemoryEngine).mockReturnValue(mockEngine);

      const serverError = new Error('Server crashed');
      const mockStart = vi.fn().mockRejectedValue(serverError);
      const mockClose = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createMemoryMCPServer).mockReturnValue({
        start: mockStart,
        close: mockClose,
        server: {}
      } as any);

      // Act & Assert: with restart disabled, the original error propagates
      await expect(startDaemon({}, { pidFile: testPidFile, restart: false, restartDelay: 5 })).rejects.toThrow(
        'Server crashed'
      );

      expect(mockStart).toHaveBeenCalledOnce();
    });

    it('stops after exceeding restart limit', async () => {
      // Arrange: server crashes repeatedly, restart is enabled
      vi.mocked(loadConfig).mockReturnValue({ mcp: {} });

      const mockEngine = { stats: vi.fn(), ingest: vi.fn(), recall: vi.fn() };
      vi.mocked(createMemoryEngine).mockReturnValue(mockEngine);

      const serverError = new Error('Crash');
      const mockStart = vi.fn().mockRejectedValue(serverError);
      const mockClose = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createMemoryMCPServer).mockReturnValue({
        start: mockStart,
        close: mockClose,
        server: {}
      } as any);

      // Act & Assert: with maxRestarts=1, first crash triggers restart, second crash gives up
      await expect(startDaemon({}, { pidFile: testPidFile, maxRestarts: 1, restartDelay: 5 })).rejects.toThrow(
        'Giving up'
      );

      // server.start() was called at least twice (initial + one restart attempt)
      expect(mockStart).toHaveBeenCalledTimes(2);
      // createMemoryEngine was called twice (initial + restart)
      expect(createMemoryEngine).toHaveBeenCalledTimes(2);
    });
  });

  /* ── stopDaemon ── */

  describe('stopDaemon', () => {
    it('does nothing when daemon is not running', async () => {
      await expect(stopDaemon('/nonexistent/path.pid')).resolves.toBeUndefined();
    });

    it('removes stale pid file', async () => {
      // Write a PID that doesn't exist → isDaemonRunning removes it
      // So stopDaemon will see it as not running
      writeFileSync(testPidFile, '999999999', 'utf-8');
      await stopDaemon(testPidFile);

      expect(existsSync(testPidFile)).toBe(false);
    });

    it('sends SIGTERM and cleans up PID file for running daemon', async () => {
      // Arrange: make isDaemonRunning return true by writing current PID
      writeFileSync(testPidFile, String(process.pid), 'utf-8');

      // Mock process.kill to prevent actually killing the test runner
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        // no-op: intercept both signal 0 (existence check) and SIGTERM
      });

      // Act
      await stopDaemon(testPidFile);

      // Assert: SIGTERM was sent
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');

      // Assert: PID file was cleaned up
      expect(existsSync(testPidFile)).toBe(false);

      killSpy.mockRestore();
    });

    it('continues when process.kill throws (process died between check and kill)', async () => {
      // Arrange
      writeFileSync(testPidFile, String(process.pid), 'utf-8');

      // First kill(pid, 0) succeeds (isDaemonRunning check), second kill(pid, 'SIGTERM') throws
      let killCallCount = 0;
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        killCallCount++;
        if (killCallCount === 2) {
          throw new Error('Process already exited');
        }
      });

      // Act
      await stopDaemon(testPidFile);

      // Assert: PID file was cleaned up despite the error
      expect(existsSync(testPidFile)).toBe(false);

      killSpy.mockRestore();
    });
  });
});
