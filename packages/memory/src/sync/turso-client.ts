import type { DatabaseOpts } from '@tursodatabase/sync';
import { connect } from '@tursodatabase/sync';

import type { SyncRecord, SyncSnapshot, TursoClient, TursoSyncConfig, TursoUploadResult } from './types.js';

class NoopTursoClient implements TursoClient {
  async upload(snapshot: SyncSnapshot): Promise<TursoUploadResult> {
    return {
      nextCursor: snapshot.cursor,
      uploadedCount: snapshot.records.length
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
  authToken: string | (() => Promise<string>);
  databaseUrl: string;
}

async function resolveAuthToken(authToken: TursoHttpClientConfig['authToken']): Promise<string> {
  const resolved = typeof authToken === 'function' ? await authToken() : authToken;
  return resolved;
}

class TursoHttpClient implements TursoClient {
  readonly #config: TursoHttpClientConfig;

  constructor(config: TursoHttpClientConfig) {
    this.#config = config;
  }

  async upload(snapshot: SyncSnapshot): Promise<TursoUploadResult> {
    const authToken = await resolveAuthToken(this.#config.authToken);
    const response = await fetch(`${this.#config.databaseUrl}/sync/upload`, {
      body: JSON.stringify(snapshot),
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json'
      },
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Turso upload failed with status ${response.status}`);
    }

    return (await response.json()) as TursoUploadResult;
  }

  async download(cursor: string): Promise<SyncSnapshot> {
    const authToken = await resolveAuthToken(this.#config.authToken);
    const response = await fetch(`${this.#config.databaseUrl}/sync/download?cursor=${encodeURIComponent(cursor)}`, {
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
  authToken?: string | (() => Promise<string>);
  clientName?: string;
  fetch?: typeof fetch;
  longPollTimeoutMs?: number;
  path: string;
  remoteWritesExperimental?: boolean;
  tracing?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  url: string;
}

interface TursoSyncDatabase {
  checkpoint(): Promise<void>;
  close(): Promise<void>;
  connect(): Promise<void>;
  get(sql: string, ...bindParameters: unknown[]): Promise<unknown>;
  pull(): Promise<boolean>;
  push(): Promise<void>;
  run(sql: string, ...bindParameters: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>;
  stats(): Promise<Record<string, unknown>>;
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
  readonly #config: TursoSyncClientConfig;

  constructor(config: TursoSyncClientConfig) {
    this.#config = config;
  }

  async #getDatabase(): Promise<TursoSyncDatabase> {
    this.#databasePromise ??= (async () => {
      const database = (await connect(toDatabaseOpts(this.#config))) as unknown as TursoSyncDatabase;
      await database.connect();
      await database.run(SNAPSHOT_TABLE_SQL);
      return database;
    })();

    return await this.#databasePromise;
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
      nextCursor: snapshot.cursor,
      uploadedCount: snapshot.records.length
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
      records: (() => {
        try {
          return JSON.parse(payload) as SyncRecord[];
        } catch {
          return [] as SyncRecord[];
        }
      })()
    };
  }

  async checkpoint(): Promise<void> {
    const database = await this.#getDatabase();
    await database.checkpoint();
  }

  async stats(): Promise<Record<string, unknown>> {
    const database = await this.#getDatabase();
    return await database.stats();
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
      authToken: config.authToken,
      path: config.path,
      url: config.databaseUrl,
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
