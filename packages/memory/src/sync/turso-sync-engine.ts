import { connect } from '@tursodatabase/sync';

import type { SyncRunResult, SyncStatus } from './types.js';

export interface TursoSyncEngineConfig {
  /** Auth token for the remote database. */
  authToken?: string | (() => Promise<string>);
  /** Optional client name for distinguishing replicas. */
  clientName?: string;
  /** Path to the local SQLite database file. */
  path: string;
  /** Remote Turso database URL (e.g. libsql://db-org.turso.io). */
  url?: string;
}

export interface TursoSyncEngine {
  close(): Promise<void>;
  pause(): void;
  resume(): void;
  status(): SyncStatus;
  sync(): Promise<SyncRunResult>;
}

interface SyncState {
  downloaded: number;
  lastError?: string | undefined;
  status: SyncStatus;
  uploaded: number;
}

/**
 * Create a TursoSyncEngine that replicates a local SQLite database
 * bidirectionally with Turso Cloud using `@tursodatabase/sync`.
 *
 * - `sync()` pulls remote changes, pushes local changes, and checkpoints WAL.
 * - `pause()` stops automatic sync loops but does not close the connection.
 * - `resume()` allows sync to proceed again.
 * - `close()` shuts down the underlying sync connection.
 */
export async function createTursoSyncEngine(config: TursoSyncEngineConfig): Promise<TursoSyncEngine> {
  const opts: Parameters<typeof connect>[0] = {
    path: config.path,
    clientName: config.clientName ?? 'agentsy-memory'
  };

  if (config.url !== undefined) {
    opts.url = config.url;
  }

  if (config.authToken !== undefined) {
    opts.authToken = config.authToken;
  }

  const client = await connect(opts);

  await client.connect();

  const state: SyncState = {
    status: 'idle',
    uploaded: 0,
    downloaded: 0
  };

  async function doSync(): Promise<SyncRunResult> {
    if (state.status === 'paused') {
      return {
        downloaded: 0,
        nextCursor: '',
        resolvedConflicts: 0,
        status: 'paused',
        unresolvedConflicts: 0,
        uploaded: 0
      };
    }

    state.status = 'running';

    try {
      // Pull remote changes
      const pulled = await client.pull();
      const downloaded = pulled ? 1 : 0;

      // Push local changes
      await client.push();
      const stats = await client.stats();
      const uploaded = Math.max(stats.cdcOperations, 0);

      // Checkpoint WAL
      await client.checkpoint();

      state.status = 'idle';
      state.downloaded += downloaded;
      state.uploaded += uploaded;
      state.lastError = undefined;

      return {
        downloaded,
        nextCursor: '',
        resolvedConflicts: 0,
        status: 'success',
        unresolvedConflicts: 0,
        uploaded
      };
    } catch (error) {
      state.status = 'error';
      state.lastError = error instanceof Error ? error.message : String(error);

      return {
        downloaded: 0,
        error: {
          code: 'SYNC_FAILED',
          message: state.lastError,
          retryable: true
        },
        nextCursor: '',
        resolvedConflicts: 0,
        status: 'error',
        unresolvedConflicts: 0,
        uploaded: 0
      };
    }
  }

  return {
    async sync() {
      return doSync();
    },

    pause() {
      state.status = 'paused';
    },

    resume() {
      if (state.status === 'paused') {
        state.status = 'idle';
      }
    },

    status() {
      return state.status;
    },

    async close() {
      await client.close();
      state.status = 'idle';
    }
  };
}
