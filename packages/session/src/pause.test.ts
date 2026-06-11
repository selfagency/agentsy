import { describe, expect, it, vi } from 'vitest';
import { createPauseManager } from './pause.js';

describe('PauseManager', () => {
  describe('pause / resume', () => {
    it('pauses and resumes a session', async () => {
      const pm = createPauseManager();
      const pausePromise = pm.pause('ses-1', 'awaiting approval');

      expect(pm.isPaused('ses-1')).toBe(true);
      expect(pm.getPausedSessionIds()).toEqual(['ses-1']);
      expect(pm.getEntry('ses-1')?.reason).toBe('awaiting approval');

      pm.resume('ses-1', { approved: true });
      const resolution = await pausePromise;
      expect(resolution).toEqual({ approved: true });
      expect(pm.isPaused('ses-1')).toBe(false);
    });

    it('rejects a paused session', async () => {
      const pm = createPauseManager();
      const pausePromise = pm.pause('ses-2', 'needs review');

      pm.reject('ses-2', new Error('denied'));
      await expect(pausePromise).rejects.toThrow('denied');
      expect(pm.isPaused('ses-2')).toBe(false);
    });

    it('throws if session is already paused', () => {
      const pm = createPauseManager();
      pm.pause('ses-3', 'busy');
      expect(() => pm.pause('ses-3', 'again')).toThrow('already paused');
    });

    it('throws if resume is called on a non-paused session', () => {
      const pm = createPauseManager();
      expect(() => pm.resume('nonexistent')).toThrow('is not paused');
    });

    it('throws if reject is called on a non-paused session', () => {
      const pm = createPauseManager();
      expect(() => pm.reject('nonexistent', new Error('nope'))).toThrow('is not paused');
    });
  });

  describe('checkForStale', () => {
    it('resolves stale paused sessions', async () => {
      const pm = createPauseManager();
      const pausePromise = pm.pause('ses-stale', 'slow');
      expect(pm.getPausedSessionIds()).toHaveLength(1);

      // Use a threshold of 0 to make it immediately stale
      const staleIds = pm.checkForStale(0);
      expect(staleIds).toEqual(['ses-stale']);

      const resolution = await pausePromise;
      expect(resolution).toEqual({ stale: true, reason: 'timeout' });
      expect(pm.isPaused('ses-stale')).toBe(false);
    });

    it('only resolves sessions older than threshold', () => {
      const pm = createPauseManager();
      pm.pause('fresh', 'just started');
      const threshold = 10_000; // 10 seconds
      const staleIds = pm.checkForStale(threshold);
      expect(staleIds).toEqual([]);
      expect(pm.isPaused('fresh')).toBe(true);
    });
  });

  describe('events', () => {
    it('emits pause event', () => {
      const pm = createPauseManager() as ReturnType<typeof createPauseManager> & {
        on: (event: string, handler: (...args: unknown[]) => void) => void;
      };
      const handler = vi.fn();
      pm.on('pause', handler);
      pm.pause('ses-evt', 'testing');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'ses-evt' }));
    });

    it('emits resume event', () => {
      const pm = createPauseManager() as ReturnType<typeof createPauseManager> & {
        on: (event: string, handler: (...args: unknown[]) => void) => void;
      };
      const handler = vi.fn();
      pm.on('resume', handler);
      pm.pause('ses-res', 'waiting');
      pm.resume('ses-res', 'ok');
      expect(handler).toHaveBeenCalledWith('ses-res', 'ok');
    });

    it('emits reject event', () => {
      const pm = createPauseManager() as ReturnType<typeof createPauseManager> & {
        on: (event: string, handler: (...args: unknown[]) => void) => void;
      };
      const handler = vi.fn();
      pm.on('reject', handler);
      // Suppress unhandled rejection since we're testing the event
      pm.pause('ses-rej', 'pending').catch(() => {
        /* suppressed */
      });
      pm.reject('ses-rej', new Error('nope'));
      expect(handler).toHaveBeenCalledWith('ses-rej', expect.any(Error));
    });

    it('emits stale event', () => {
      const pm = createPauseManager() as ReturnType<typeof createPauseManager> & {
        on: (event: string, handler: (...args: unknown[]) => void) => void;
      };
      const handler = vi.fn();
      pm.on('stale', handler);
      pm.pause('ses-old', 'aging');
      pm.checkForStale(0);
      expect(handler).toHaveBeenCalledWith('ses-old', expect.objectContaining({ sessionId: 'ses-old' }));
    });
  });
});
