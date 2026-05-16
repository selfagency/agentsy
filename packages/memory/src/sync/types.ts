export type SyncStatus = "idle" | "running" | "error" | "paused";

export type SyncMode = "local-only" | "remote-shadow";

export type MemorySyncTier = "raw" | "wiki" | "vector";

export type MergePolicy =
  | "lastWriteWins"
  | "localWins"
  | "remoteWins"
  | "fieldMerge"
  | "manualRequired";

export interface SyncMetrics {
  successes: number;
  failures: number;
  retries: number;
  conflicts: number;
}

export interface ConflictResolutionResult {
  status: "resolved" | "manual";
  policy: MergePolicy;
  record: SyncRecord | null;
}

export interface SyncError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface SyncRecord {
  id: string;
  tier: MemorySyncTier;
  updatedAt: string;
  content: string;
  metadata?: Record<string, unknown>;
  relationships?: string[];
  vectorFingerprint?: string;
}

export interface SyncSnapshot {
  cursor: string;
  records: SyncRecord[];
}

export interface ConflictRecord {
  id: string;
  recordId: string;
  tier: MemorySyncTier;
  local: SyncRecord;
  remote: SyncRecord;
  detectedAt: string;
  policy: MergePolicy;
}

export interface ConflictStore {
  save(conflict: ConflictRecord): Promise<void>;
  get(id: string): Promise<ConflictRecord | null>;
  list(): Promise<ConflictRecord[]>;
  resolve(id: string): Promise<void>;
  pendingCount(): Promise<number>;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  checksum: string;
  sourceVersion: number;
  recordCount: number;
}

export interface BackupManifest extends BackupSnapshot {
  schemaVersion: number;
  targetDatabaseId: string;
  records: SyncRecord[];
}

export interface RestoreResult {
  snapshotId: string;
  restoredCount: number;
  restoredAt: string;
  rollbackSnapshotId?: string;
}

export interface RemoteValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SyncRunResult {
  status: "success" | "error" | "paused";
  uploaded: number;
  downloaded: number;
  resolvedConflicts: number;
  unresolvedConflicts: number;
  nextCursor: string;
  error?: SyncError;
}

export interface TursoUploadResult {
  uploadedCount: number;
  nextCursor: string;
}

export interface TursoSyncConfig {
  path?: string;
  databaseUrl: string;
  authToken: string | (() => Promise<string>);
  syncIntervalMs: number;
  maxRetries: number;
  mode?: SyncMode;
  mergePolicy?: MergePolicy;
  conflictStore?: ConflictStore;
  credentialSource?: CredentialSource;
  clientName?: string;
  longPollTimeoutMs?: number;
  tracing?: "error" | "warn" | "info" | "debug" | "trace";
  remoteWritesExperimental?: boolean;
  fetch?: typeof fetch;
  client?: TursoClient;
}

export type CredentialSource =
  | "environment"
  | "injected"
  | "config-file"
  | "source-code";

export interface SyncScheduler {
  start(): void;
  stop(): void;
  triggerNow(): Promise<SyncRunResult>;
  getNextRunAt(): Date | null;
}

export interface SyncManagerLike {
  sync(localState: SyncSnapshot): Promise<SyncRunResult>;
}

export interface SyncSchedulerOptions {
  intervalMs: number;
  initialDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
  jitterRatio?: number;
  getLocalState(): SyncSnapshot | Promise<SyncSnapshot>;
  now?: () => Date;
  random?: () => number;
}

export interface RestoreSnapshotOptions {
  targetDatabaseId: string;
  schemaVersion: number;
  force?: boolean;
}

export interface BackupManager {
  createSnapshot(): Promise<BackupManifest>;
  verifySnapshot(snapshotId: string): Promise<boolean>;
  restoreSnapshot(
    snapshotId: string,
    options: RestoreSnapshotOptions
  ): Promise<RestoreResult>;
  rollback(restorePointId: string): Promise<RestoreResult>;
}

export interface BackupManagerOptions {
  databaseId: string;
  schemaVersion: number;
  getCurrentState(): Promise<SyncSnapshot>;
  applySnapshot(snapshot: SyncSnapshot): Promise<void>;
  now?: () => Date;
  createId?: () => string;
}

export interface BackupManifestInput {
  snapshotId: string;
  sourceVersion: number;
  schemaVersion: number;
  targetDatabaseId: string;
  records: SyncRecord[];
  createdAt: string;
}

export interface SecureSyncErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  diagnosticContext?: string;
}

export interface SecureSyncErrorOptions {
  retryable: boolean;
  code?: string;
  diagnosticContext?: string;
}

export interface SyncMetricsRegistrySnapshot {
  sync_runs_total: number;
  sync_failures_total: number;
  sync_conflicts_total: number;
  backup_runs_total: number;
  backup_restore_total: number;
  sync_duration_ms: {
    average: number;
    max: number;
  };
  queue_depth: {
    average: number;
    max: number;
  };
  retries_total: number;
  backup_success_rate: number;
  restore_success_rate: number;
}

export interface SyncMetricsRegistry {
  recordSyncRun(input: {
    status: SyncRunResult["status"];
    durationMs: number;
    queueDepth: number;
    conflicts: number;
    retries: number;
  }): void;
  recordBackupRun(input: { success: boolean; durationMs: number }): void;
  recordRestoreRun(input: { success: boolean; durationMs: number }): void;
  snapshot(): SyncMetricsRegistrySnapshot;
}

export interface TursoClient {
  upload(snapshot: SyncSnapshot): Promise<TursoUploadResult>;
  download(cursor: string): Promise<SyncSnapshot>;
  checkpoint?(): Promise<void>;
  stats?(): Promise<Record<string, unknown>>;
  close?(): Promise<void>;
}
