import { collectConflicts, resolveConflict } from './conflict-resolution.js';
import { validateRemoteSnapshot } from './integrity.js';
import { createSecureSyncErrorEnvelope, validateCredentialSource } from './security.js';
import { createDefaultTursoClient } from './turso-client.js';
import type {
  SyncMetrics,
  SyncRecord,
  SyncRunResult,
  SyncSnapshot,
  SyncStatus,
  TursoClient,
  TursoSyncConfig
} from './types.js';

const INITIAL_SYNC_METRICS: SyncMetrics = {
  conflicts: 0,
  failures: 0,
  retries: 0,
  successes: 0
};

function createRecordKey(record: Pick<SyncRecord, 'id' | 'tier'>): string {
  return `${record.tier}:${record.id}`;
}

function isNonEmptyString(value: string): boolean {
  return /\S/u.test(value);
}

function hasAuthToken(value: TursoSyncConfig['authToken']): boolean {
  if (typeof value === 'function') {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return isNonEmptyString(value);
}

function requiresAuthToken(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1';
  } catch {
    return true;
  }
}

function validateSyncConfig(config: TursoSyncConfig): void {
  const issues: string[] = [];

  if (!isNonEmptyString(config.databaseUrl)) {
    issues.push('databaseUrl');
  }

  if (requiresAuthToken(config.databaseUrl) && !hasAuthToken(config.authToken)) {
    issues.push('authToken');
  }

  if (!Number.isFinite(config.syncIntervalMs) || config.syncIntervalMs <= 0) {
    issues.push('syncIntervalMs');
  }

  if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0) {
    issues.push('maxRetries');
  }

  if (config.client === undefined && config.mode !== 'local-only' && !isNonEmptyString(config.path ?? '')) {
    issues.push('path');
  }

  if (config.credentialSource !== undefined) {
    validateCredentialSource(config.credentialSource);
  }

  if (issues.length > 0) {
    throw new Error(`Invalid Turso sync config: ${issues.join(', ')}`);
  }
}

export class TursoManager {
  readonly #client: TursoClient;
  readonly #metrics: SyncMetrics;
  readonly #config: TursoSyncConfig;
  #status: SyncStatus;

  constructor(config: TursoSyncConfig) {
    validateSyncConfig(config);
    this.#config = config;
    this.#client = config.client ?? createDefaultTursoClient(config);
    this.#metrics = { ...INITIAL_SYNC_METRICS };
    this.#status = 'idle';
  }

  getStatus(): SyncStatus {
    return this.#status;
  }

  getMetrics(): SyncMetrics {
    return { ...this.#metrics };
  }

  pause(): void {
    this.#status = 'paused';
  }

  resume(): void {
    this.#status = 'idle';
  }

  async upload(snapshot: SyncSnapshot) {
    return await this.#client.upload(snapshot);
  }

  async download(cursor: string) {
    const snapshot = await this.#client.download(cursor);
    const validation = validateRemoteSnapshot(snapshot);

    if (!validation.valid) {
      throw new Error(`Invalid remote snapshot: ${validation.errors.join('; ')}`);
    }

    return snapshot;
  }

  #buildUploadSnapshot(
    localState: SyncSnapshot,
    remoteState: SyncSnapshot,
    resolvedRecords: SyncRecord[],
    manualConflictIds: Set<string>
  ): SyncSnapshot {
    const mergedRecords = new Map(remoteState.records.map(record => [createRecordKey(record), record]));

    for (const record of localState.records) {
      const key = createRecordKey(record);
      if (!manualConflictIds.has(key)) {
        mergedRecords.set(key, record);
      }
    }

    for (const record of resolvedRecords) {
      mergedRecords.set(createRecordKey(record), record);
    }

    return {
      cursor: localState.cursor,
      records: [...mergedRecords.values()]
    };
  }

  async sync(localState: SyncSnapshot): Promise<SyncRunResult> {
    if (this.#status === 'paused') {
      return {
        downloaded: 0,
        nextCursor: localState.cursor,
        resolvedConflicts: 0,
        status: 'paused',
        unresolvedConflicts: 0,
        uploaded: 0
      };
    }

    this.#status = 'running';

    try {
      const remoteSnapshot = await this.download(localState.cursor);
      const mergePolicy = this.#config.mergePolicy ?? 'lastWriteWins';
      const conflicts = collectConflicts(localState.records, remoteSnapshot.records, {
        policy: mergePolicy
      });
      const resolvedRecords: SyncRecord[] = [];
      const manualConflictIds = new Set<string>();
      let resolvedConflicts = 0;
      let unresolvedConflicts = 0;

      for (const conflict of conflicts) {
        const resolution = resolveConflict(conflict, mergePolicy);
        if (resolution.status === 'manual') {
          unresolvedConflicts += 1;
          manualConflictIds.add(createRecordKey(conflict.local));
          if (this.#config.conflictStore) {
            await this.#config.conflictStore.save(conflict);
          }
          continue;
        }

        resolvedConflicts += 1;
        if (resolution.record) {
          resolvedRecords.push(resolution.record);
        }
      }

      const uploadResult = await this.upload(
        this.#buildUploadSnapshot(localState, remoteSnapshot, resolvedRecords, manualConflictIds)
      );

      this.#metrics.successes += 1;
      this.#metrics.conflicts += conflicts.length;
      this.#status = 'idle';

      return {
        downloaded: remoteSnapshot.records.length,
        nextCursor: uploadResult.nextCursor,
        resolvedConflicts,
        status: 'success',
        unresolvedConflicts,
        uploaded: uploadResult.uploadedCount
      };
    } catch (error) {
      const envelope = createSecureSyncErrorEnvelope(error, {
        code: 'SYNC_FAILED',
        retryable: this.#config.maxRetries > 0
      });
      this.#metrics.failures += 1;
      this.#status = 'error';

      return {
        downloaded: 0,
        error: {
          code: envelope.code,
          message: envelope.message,
          retryable: envelope.retryable
        },
        nextCursor: localState.cursor,
        resolvedConflicts: 0,
        status: 'error',
        unresolvedConflicts: 0,
        uploaded: 0
      };
    }
  }
}

export function createTursoManager(config: TursoSyncConfig): TursoManager {
  return new TursoManager(config);
}
