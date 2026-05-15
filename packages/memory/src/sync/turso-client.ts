import type { DatabaseOpts } from '@tursodatabase/sync';
import { connect } from '@tursodatabase/sync';

import type { SyncSnapshot, TursoClient, TursoSyncConfig, TursoUploadResult } from './types.js';

class NoopTursoClient implements TursoClient {
  async upload(snapshot: SyncSnapshot): Promise<TursoUploadResult> {
    return {
      uploadedCount: snapshot.records.length,
      nextCursor: snapshot.cursor
    };
  }

  async download(cursor: string): Promise<SyncSnapshot> {
    return {
      cursor,
      records: []
    };
  }
}

export function createNoopTursoClient(): TursoClient {
  return new NoopTursoClient();
}

export interface TursoHttpClientConfig {
  databaseUrl: string;
  authToken: string | (() => Promise<string>);
}

async function resolveAuthToken(authToken: TursoHttpClientConfig['authToken']): Promise<string> {
  return typeof authToken === 'function' ? authToken() : authToken;
}

class TursoHttpClient implements TursoClient {
  constructor(private readonly config: TursoHttpClientConfig) {}

  async upload(snapshot: SyncSnapshot): Promise<TursoUploadResult> {
    const authToken = await resolveAuthToken(this.config.authToken);
    const response = await fetch(`${this.config.databaseUrl}/sync/upload`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(snapshot)
    });

    if (!response.ok) {
      throw new Error(`Turso upload failed with status ${response.status}`);
    }

    return (await response.json()) as TursoUploadResult;
  }

  async download(cursor: string): Promise<SyncSnapshot> {
    const authToken = await resolveAuthToken(this.config.authToken);
    const response = await fetch(`${this.config.databaseUrl}/sync/download?cursor=${encodeURIComponent(cursor)}`, {
      headers: {
        authorization: `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Turso download failed with status ${response.status}`);
    }

    return (await response.json()) as SyncSnapshot;
  }
}

export function createTursoHttpClient(config: TursoHttpClientConfig): TursoClient {
  return new TursoHttpClient(config);
}

export interface TursoSyncClientConfig {
  path: string;
  url: string;
  authToken?: string | (() => Promise<string>);
  clientName?: string;
  longPollTimeoutMs?: number;
  tracing?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  remoteWritesExperimental?: boolean;
  fetch?: typeof fetch;
}

interface TursoSyncDatabase {
  connect(): Promise<void>;
  run(sql: string, ...bindParameters: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>;
  get(sql: string, ...bindParameters: unknown[]): Promise<unknown>;
  push(): Promise<void>;
  pull(): Promise<boolean>;
  checkpoint(): Promise<void>;
  stats(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

const DEFAULT_BUCKET = 'default';
const SNAPSHOT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agentsy_memory_sync_snapshots (
    bucket TEXT PRIMARY KEY,
    cursor TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

function isRowObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function toDatabaseOpts(config: TursoSyncClientConfig): DatabaseOpts {
  return {
    path: config.path,
    url: config.url,
    ...(config.authToken === undefined ? {} : { authToken: config.authToken }),
    ...(config.clientName === undefined ? {} : { clientName: config.clientName }),
    ...(config.longPollTimeoutMs === undefined ? {} : { longPollTimeoutMs: config.longPollTimeoutMs }),
    ...(config.tracing === undefined ? {} : { tracing: config.tracing }),
    ...(config.remoteWritesExperimental === undefined
      ? {}
      : { remoteWritesExperimental: config.remoteWritesExperimental }),
    ...(config.fetch === undefined ? {} : { fetch: config.fetch })
  };
}

class TursoSyncClient implements TursoClient {
  #databasePromise: Promise<TursoSyncDatabase> | null = null;

  constructor(private readonly config: TursoSyncClientConfig) {}

  async #getDatabase(): Promise<TursoSyncDatabase> {
    if (!this.#databasePromise) {
      this.#databasePromise = (async () => {
        const database = (await connect(toDatabaseOpts(this.config))) as unknown as TursoSyncDatabase;
        await database.connect();
        await database.run(SNAPSHOT_TABLE_SQL);
        return database;
      })();
    }

    return this.#databasePromise;
  }

  async upload(snapshot: SyncSnapshot): Promise<TursoUploadResult> {
    const database = await this.#getDatabase();
    await database.run(
      `
        INSERT INTO agentsy_memory_sync_snapshots (bucket, cursor, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bucket) DO UPDATE SET
          cursor = excluded.cursor,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      DEFAULT_BUCKET,
      snapshot.cursor,
      JSON.stringify(snapshot.records),
      new Date().toISOString()
    );
    await database.push();

    return {
      uploadedCount: snapshot.records.length,
      nextCursor: snapshot.cursor
    };
  }

  async download(cursor: string): Promise<SyncSnapshot> {
    const database = await this.#getDatabase();
    await database.pull();
    const row = await database.get(
      'SELECT cursor, payload FROM agentsy_memory_sync_snapshots WHERE bucket = ?',
      DEFAULT_BUCKET
    );

    if (!isRowObject(row)) {
      return {
        cursor,
        records: []
      };
    }

    const remoteCursor = readString(row, 'cursor') ?? cursor;
    const payload = readString(row, 'payload');

    if (payload === null) {
      return {
        cursor: remoteCursor,
        records: []
      };
    }

    return {
      cursor: remoteCursor,
      records: JSON.parse(payload) as SyncSnapshot['records']
    };
  }

  async checkpoint(): Promise<void> {
    const database = await this.#getDatabase();
    await database.checkpoint();
  }

  async stats(): Promise<Record<string, unknown>> {
    const database = await this.#getDatabase();
    return database.stats();
  }

  async close(): Promise<void> {
    const database = await this.#getDatabase();
    await database.close();
  }
}

export function createTursoSyncClient(config: TursoSyncClientConfig): TursoClient {
  return new TursoSyncClient(config);
}

export function createDefaultTursoClient(config: TursoSyncConfig): TursoClient {
  if (config.path) {
    return createTursoSyncClient({
      path: config.path,
      url: config.databaseUrl,
      authToken: config.authToken,
      ...(config.clientName === undefined ? {} : { clientName: config.clientName }),
      ...(config.longPollTimeoutMs === undefined ? {} : { longPollTimeoutMs: config.longPollTimeoutMs }),
      ...(config.tracing === undefined ? {} : { tracing: config.tracing }),
      ...(config.remoteWritesExperimental === undefined
        ? {}
        : { remoteWritesExperimental: config.remoteWritesExperimental }),
      ...(config.fetch === undefined ? {} : { fetch: config.fetch })
    });
  }

  if (config.mode === 'local-only') {
    return createNoopTursoClient();
  }

  throw new Error('Turso sync path is required unless sync mode is explicitly local-only.');
}
