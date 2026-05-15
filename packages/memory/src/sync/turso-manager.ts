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
  successes: 0,
  failures: 0,
  retries: 0,
  conflicts: 0
};

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function hasAuthToken(value: TursoSyncConfig['authToken']): boolean {
  return typeof value === 'function' || (typeof value === 'string' && isNonEmptyString(value));
}

function requiresAuthToken(databaseUrl: string): boolean {
  return !databaseUrl.startsWith('http://localhost') && !databaseUrl.startsWith('http://127.0.0.1');
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
  #status: SyncStatus;

  constructor(private readonly config: TursoSyncConfig) {
    validateSyncConfig(config);
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
    return this.#client.upload(snapshot);
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
    resolvedRecords: SyncRecord[],
    manualConflictIds: Set<string>
  ): SyncSnapshot {
    const filteredLocal = localState.records.filter(record => !manualConflictIds.has(record.id));
    const resolvedById = new Map(resolvedRecords.map(record => [record.id, record]));
    const mergedRecords = filteredLocal.map(record => resolvedById.get(record.id) ?? record);

    return {
      cursor: localState.cursor,
      records: mergedRecords
    };
  }

  async sync(localState: SyncSnapshot): Promise<SyncRunResult> {
    if (this.#status === 'paused') {
      return {
        status: 'paused',
        uploaded: 0,
        downloaded: 0,
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        nextCursor: localState.cursor
      };
    }

    this.#status = 'running';

    try {
      const remoteSnapshot = await this.download(localState.cursor);
      const mergePolicy = this.config.mergePolicy ?? 'lastWriteWins';
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
          manualConflictIds.add(conflict.recordId);
          if (this.config.conflictStore) {
            await this.config.conflictStore.save(conflict);
          }
          continue;
        }

        resolvedConflicts += 1;
        if (resolution.record) {
          resolvedRecords.push(resolution.record);
        }
      }

      const uploadResult = await this.upload(this.#buildUploadSnapshot(localState, resolvedRecords, manualConflictIds));

      this.#metrics.successes += 1;
      this.#metrics.conflicts += conflicts.length;
      this.#status = 'idle';

      return {
        status: 'success',
        uploaded: uploadResult.uploadedCount,
        downloaded: remoteSnapshot.records.length,
        resolvedConflicts,
        unresolvedConflicts,
        nextCursor: uploadResult.nextCursor
      };
    } catch (error) {
      const envelope = createSecureSyncErrorEnvelope(error, {
        code: 'SYNC_FAILED',
        retryable: this.config.maxRetries > 0
      });
      this.#metrics.failures += 1;
      this.#status = 'error';

      return {
        status: 'error',
        uploaded: 0,
        downloaded: 0,
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        nextCursor: localState.cursor,
        error: {
          code: envelope.code,
          message: envelope.message,
          retryable: envelope.retryable
        }
      };
    }
  }
}

export function createTursoManager(config: TursoSyncConfig): TursoManager {
  return new TursoManager(config);
}
