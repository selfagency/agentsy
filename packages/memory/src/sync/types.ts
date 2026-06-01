export type SyncStatus = 'idle' | 'running' | 'error' | 'paused';

export type SyncMode = 'local-only' | 'remote-shadow';

export type MemorySyncTier = 'raw' | 'wiki' | 'vector';

export type MergePolicy = 'lastWriteWins' | 'localWins' | 'remoteWins' | 'fieldMerge' | 'manualRequired';

export interface SyncMetrics {
  conflicts: number;
  failures: number;
  retries: number;
  successes: number;
}

export interface ConflictResolutionResult {
  policy: MergePolicy;
  record: SyncRecord | null;
  status: 'resolved' | 'manual';
}

export interface SyncError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface SyncRecord {
  content: string;
  id: string;
  metadata?: Record<string, unknown>;
  relationships?: string[];
  tier: MemorySyncTier;
  updatedAt: string;
  vectorFingerprint?: string;
}

export interface SyncSnapshot {
  cursor: string;
  records: SyncRecord[];
}

export interface ConflictRecord {
  detectedAt: string;
  id: string;
  local: SyncRecord;
  policy: MergePolicy;
  recordId: string;
  remote: SyncRecord;
  tier: MemorySyncTier;
}

export interface ConflictStore {
  get(id: string): Promise<ConflictRecord | null>;
  list(): Promise<ConflictRecord[]>;
  pendingCount(): Promise<number>;
  resolve(id: string): Promise<void>;
  save(conflict: ConflictRecord): Promise<void>;
}

export interface BackupSnapshot {
  checksum: string;
  createdAt: string;
  id: string;
  recordCount: number;
  sourceVersion: number;
}

export interface BackupManifest extends BackupSnapshot {
  records: SyncRecord[];
  schemaVersion: number;
  targetDatabaseId: string;
}

export interface RestoreResult {
  restoredAt: string;
  restoredCount: number;
  rollbackSnapshotId?: string;
  snapshotId: string;
}

export interface RemoteValidationResult {
  errors: string[];
  valid: boolean;
}

export interface SyncRunResult {
  downloaded: number;
  error?: SyncError;
  nextCursor: string;
  resolvedConflicts: number;
  status: 'success' | 'error' | 'paused';
  unresolvedConflicts: number;
  uploaded: number;
}

export interface TursoUploadResult {
  nextCursor: string;
  uploadedCount: number;
}

export interface TursoSyncConfig {
  authToken: string | (() => Promise<string>);
  client?: TursoClient;
  clientName?: string;
  conflictStore?: ConflictStore;
  credentialSource?: CredentialSource;
  databaseUrl: string;
  fetch?: typeof fetch;
  longPollTimeoutMs?: number;
  maxRetries: number;
  mergePolicy?: MergePolicy;
  mode?: SyncMode;
  path?: string;
  remoteWritesExperimental?: boolean;
  syncIntervalMs: number;
  tracing?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export type CredentialSource = 'environment' | 'injected' | 'config-file' | 'source-code';

export interface SyncScheduler {
  getNextRunAt(): Date | null;
  start(): void;
  stop(): void;
  triggerNow(): Promise<SyncRunResult>;
}

export interface SyncManagerLike {
  sync(localState: SyncSnapshot): Promise<SyncRunResult>;
}

export interface SyncSchedulerOptions {
  getLocalState(): SyncSnapshot | Promise<SyncSnapshot>;
  initialDelayMs: number;
  intervalMs: number;
  jitterRatio?: number;
  maxDelayMs: number;
  maxRetries: number;
  now?: () => Date;
  random?: () => number;
}

export interface RestoreSnapshotOptions {
  force?: boolean;
  schemaVersion: number;
  targetDatabaseId: string;
}

export interface BackupManager {
  createSnapshot(): Promise<BackupManifest>;
  restoreSnapshot(snapshotId: string, options: RestoreSnapshotOptions): Promise<RestoreResult>;
  rollback(restorePointId: string): Promise<RestoreResult>;
  verifySnapshot(snapshotId: string): Promise<boolean>;
}

export interface BackupManagerOptions {
  applySnapshot(snapshot: SyncSnapshot): Promise<void>;
  createId?: () => string;
  databaseId: string;
  getCurrentState(): Promise<SyncSnapshot>;
  now?: () => Date;
  schemaVersion: number;
}

export interface BackupManifestInput {
  createdAt: string;
  records: SyncRecord[];
  schemaVersion: number;
  snapshotId: string;
  sourceVersion: number;
  targetDatabaseId: string;
}

export interface SecureSyncErrorEnvelope {
  code: string;
  diagnosticContext?: string;
  message: string;
  retryable: boolean;
}

export interface SecureSyncErrorOptions {
  code?: string;
  diagnosticContext?: string;
  retryable: boolean;
}

export interface SyncMetricsRegistrySnapshot {
  backup_restore_total: number;
  backup_runs_total: number;
  backup_success_rate: number;
  queue_depth: {
    average: number;
    max: number;
  };
  restore_success_rate: number;
  retries_total: number;
  sync_conflicts_total: number;
  sync_duration_ms: {
    average: number;
    max: number;
  };
  sync_failures_total: number;
  sync_runs_total: number;
}

export interface SyncMetricsRegistry {
  recordBackupRun(input: { success: boolean; durationMs: number }): void;
  recordRestoreRun(input: { success: boolean; durationMs: number }): void;
  recordSyncRun(input: {
    status: SyncRunResult['status'];
    durationMs: number;
    queueDepth: number;
    conflicts: number;
    retries: number;
  }): void;
  snapshot(): SyncMetricsRegistrySnapshot;
}

export interface TursoClient {
  checkpoint?(): Promise<void>;
  close?(): Promise<void>;
  download(cursor: string): Promise<SyncSnapshot>;
  stats?(): Promise<Record<string, unknown>>;
  upload(snapshot: SyncSnapshot): Promise<TursoUploadResult>;
}
