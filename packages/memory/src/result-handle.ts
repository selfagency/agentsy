/**
 * Awaitable result handle for memory operations.
 *
 * Inspired by cognee's RememberResult — printable, awaitable, truthy.
 * Background improve() errors write to the handle instead of raising.
 */

import type { EntrySource, MemoryEntry } from './entries/index.js';

export type RememberStatus = 'session_stored' | 'completed' | 'errored';

export type ImproveStatus = 'idle' | 'running' | 'completed' | 'errored';

export interface RememberResultOptions {
  entryId?: string;
  entryType?: MemoryEntry['type'];
  sessionId?: string;
}

/**
 * Result handle returned by remember().
 *
 * Returns immediately with status "session_stored". Background improve()
 * completes asynchronously. Callers can await the result to block on
 * completion, check done() to poll, or check status to see what happened.
 */
export class RememberResult {
  readonly status: RememberStatus;
  readonly error: Error | undefined;
  private readonly _entryId: string | undefined;
  private readonly _entryType: MemoryEntry['type'] | undefined;
  private readonly _sessionId: string | undefined;
  private _improvePromise: Promise<void> | undefined;
  private _improveStatus: ImproveStatus = 'idle';
  private _improveError: Error | undefined;

  constructor(options: RememberResultOptions & { status: RememberStatus; error?: Error }) {
    this.status = options.status;
    this._entryId = options.entryId;
    this._entryType = options.entryType;
    this._sessionId = options.sessionId;
    this.error = options.error;
  }

  get entryId(): string | undefined {
    return this._entryId;
  }

  get entryType(): MemoryEntry['type'] | undefined {
    return this._entryType;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /** Attach a background improve() promise. Called internally. */
  setImproveTask(promise: Promise<void>): void {
    this._improveStatus = 'running';
    this._improvePromise = promise;
    promise
      .then(() => {
        this._improveStatus = 'completed';
      })
      .catch((err: Error) => {
        this._improveError = err;
        this._improveStatus = 'errored';
      });
  }

  /** True if the background improve() has finished (or was never started). */
  get done(): boolean {
    if (this._improvePromise === undefined) {
      return true;
    }
    return this._improveStatus === 'completed' || this._improveStatus === 'errored';
  }

  /** Status of the background improve() task. */
  get improveStatus(): ImproveStatus {
    return this._improveStatus;
  }

  /** Error from the improve() task, if any. */
  get improveError(): Error | undefined {
    return this._improveError;
  }

  /** Wait for background improve() to complete. Resolves when done. */
  wait(): Promise<void> {
    if (this.done) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      const check = (): void => {
        if (this.done) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }
}

export interface RecallResult {
  _source: EntrySource;
  entry: MemoryEntry;
  score: number;
}
