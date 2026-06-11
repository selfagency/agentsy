import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PauseEntry {
  error?: string;
  reason: string;
  resolution?: unknown;
  resolved: boolean;
  sessionId: string;
  timestamp: number;
}

export interface PauseManager {
  /**
   * Find pauses that have been waiting longer than `thresholdMs` ms and
   * auto-resolve them with `{ stale: true, reason: 'timeout' }`.
   * Returns the IDs of any stale sessions that were resolved.
   */
  checkForStale(thresholdMs: number): string[];

  /** Get metadata about a paused session, or undefined if not found. */
  getEntry(sessionId: string): PauseEntry | undefined;

  /** Return all session IDs currently in paused state. */
  getPausedSessionIds(): string[];

  /** Check if a session is currently paused. */
  isPaused(sessionId: string): boolean;
  /** Pause execution for a session. Returns a promise that resolves when resumed/rejected. */
  pause(sessionId: string, reason: string): Promise<unknown>;

  /** Reject a paused session with an error. */
  reject(sessionId: string, error: Error): void;

  /** Resume a paused session with an optional resolution value. */
  resume(sessionId: string, resolution?: unknown): void;
}

export interface PauseManagerEvents {
  pause: (entry: PauseEntry) => void;
  reject: (sessionId: string, error: Error) => void;
  resume: (sessionId: string, resolution: unknown) => void;
  stale: (sessionId: string, entry: PauseEntry) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new PauseManager that tracks paused sessions in memory.
 *
 * Paused sessions are tracked with a promise that is stored externally.
 * When {@link PauseManager.resume} or {@link PauseManager.reject} is called,
 * the promise resolves/rejects and the session is unblocked.
 */
export function createPauseManager(): PauseManager {
  const emitter = new EventEmitter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- promise storage
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; entry: PauseEntry }>();

  const self: PauseManager = {
    pause(sessionId: string, reason: string): Promise<unknown> {
      if (pending.has(sessionId)) {
        throw new Error(`Session ${sessionId} is already paused`);
      }
      const entry: PauseEntry = {
        sessionId,
        reason,
        timestamp: Date.now(),
        resolved: false
      };
      return new Promise((resolve, reject) => {
        pending.set(sessionId, { resolve, reject, entry });
        emitter.emit('pause', entry);
      });
    },

    resume(sessionId: string, resolution?: unknown): void {
      const slot = pending.get(sessionId);
      if (!slot) {
        throw new Error(`Session ${sessionId} is not paused`);
      }
      slot.entry.resolved = true;
      slot.entry.resolution = resolution;
      pending.delete(sessionId);
      slot.resolve(resolution);
      emitter.emit('resume', sessionId, resolution);
    },

    reject(sessionId: string, error: Error): void {
      const slot = pending.get(sessionId);
      if (!slot) {
        throw new Error(`Session ${sessionId} is not paused`);
      }
      slot.entry.resolved = true;
      slot.entry.error = error.message;
      pending.delete(sessionId);
      slot.reject(error);
      emitter.emit('reject', sessionId, error);
    },

    isPaused(sessionId: string): boolean {
      return pending.has(sessionId);
    },

    getPausedSessionIds(): string[] {
      return [...pending.keys()];
    },

    getEntry(sessionId: string): PauseEntry | undefined {
      return pending.get(sessionId)?.entry;
    },

    checkForStale(thresholdMs: number): string[] {
      const now = Date.now();
      const staleIds: string[] = [];
      for (const [sessionId, slot] of pending.entries()) {
        if (now - slot.entry.timestamp >= thresholdMs) {
          slot.entry.resolved = true;
          slot.entry.resolution = { stale: true, reason: 'timeout' };
          pending.delete(sessionId);
          slot.resolve({ stale: true, reason: 'timeout' });
          emitter.emit('stale', sessionId, slot.entry);
          staleIds.push(sessionId);
        }
      }
      return staleIds;
    }
  };

  // Attach typed emitter for external listeners
  (self as Record<string, unknown>).on = emitter.on.bind(emitter);
  (self as Record<string, unknown>).off = emitter.off.bind(emitter);

  return self;
}
