// @agentsy/memory — Three-layer memory engine (raw event log, synthesized wiki, vector retrieval)
// Phase 1 foundation: coordination contracts + three-tier wiki primitives.

export {
  createContextFingerprint,
  createMemoryReuseHint,
  type ContextFingerprint,
  type CreateContextFingerprintInput,
  type CreateMemoryReuseHintInput,
  type MemoryReuseHint
} from './types.js';

export {
  createAtomicWorkflowCoordinator,
  type AtomicWorkflowContext,
  type AtomicWorkflowCoordinator,
  type AtomicWorkflowResult,
  type AtomicWorkflowStep
} from './coordination/atomic-workflows.js';
export {
  loadHonkerExtension,
  type HonkerLoadFeatures,
  type HonkerLoadOptions,
  type HonkerLoadResult
} from './coordination/honker/loader.js';
export {
  createInMemoryPubSubManager,
  type ChannelListener,
  type PubSubManager
} from './coordination/pub-sub-manager.js';
export { createInMemoryScheduler, type Scheduler } from './coordination/scheduler.js';
export { createInMemoryTaskQueue, type CoordinationTask, type TaskQueue } from './coordination/task-queue.js';
export {
  createMemoryMetrics,
  redactSecretLikeValues,
  type CoordinationLatencyStats,
  type InjectionMetricsInput,
  type MemoryMetrics,
  type MemoryMetricsSnapshot,
  type RetrievalMetricsInput
} from './observability/metrics.js';
export {
  formatMemoryContextXml,
  injectMemoryContext,
  type FormatMemoryContextOptions,
  type MemoryContextCandidate,
  type XmlContextContracts
} from './retrieval/injection.js';
export {
  createDocumentIngestor,
  createHybridRetriever,
  createIndexManager,
  createKnowledgeBaseManager,
  createQueryPlanner,
  createRAGBootstrapper,
  createRAGConfig,
  createRAGMetrics,
  createRAGServerClient,
  createReindexScheduler,
  createSourceConnectors,
  packEvidenceForContext,
  rerankResults,
  sanitizeIngestSource,
  type BootstrapSummary,
  type ContextPackedEvidence,
  type ContextPackerOptions,
  type ContextPackResult,
  type CreateRAGConfigInput,
  type DocumentIngestor,
  type HybridRetriever,
  type IndexedDocumentRecord,
  type IndexManager,
  type IngestOutput,
  type IngestSource,
  type IngestSummary,
  type KnowledgeBaseManager,
  type PlannedQuery,
  type QueryPlanner,
  type RAGConfig,
  type RAGDeleteResult,
  type RAGEvidence,
  type RAGEvidenceCitation,
  type RAGHealthResult,
  type RAGMetrics,
  type RAGMetricsQueryInput,
  type RAGMetricsSnapshot,
  type RAGScoreBreakdown,
  type RAGSearchRequest,
  type RAGSearchResult,
  type RAGServerClient,
  type RAGServerClientOptions,
  type RAGServerDocument,
  type RAGSourceType,
  type RAGWebConfig,
  type RAGWeightConfig,
  type ReindexScheduler,
  type ReindexSchedulerOptions,
  type SourceConnectorOptions,
  type SourceConnectors
} from './retrieval/rag/index.js';
export {
  createMemoryRetriever,
  type MemoryRetriever,
  type MemoryRetrieverOptions,
  type MemorySearchHit,
  type MemorySearchInput,
  type MemorySearchRecord
} from './retrieval/retriever.js';
export { rankReusableMemoryBlocks, type ReusableMemoryBlock } from './reuse.js';

export {
  createAgentFsManager,
  type AgentFsEntry,
  type AgentFsManager,
  type AgentFsOptions
} from './filesystem/agentfs/manager.js';

export {
  createScopeManager,
  type MemoryScope,
  type ScopeAccessRequest,
  type ScopeAction,
  type ScopeGrant,
  type ScopeManager,
  type ScopePolicy
} from './scope/scope-manager.js';
export {
  collectConflicts,
  computeSyncChecksum,
  createBackupManager,
  createBackupManifest,
  createConflictStore,
  createDefaultTursoClient,
  createFileConflictStore,
  createMemoryStateAdapter,
  createNoopTursoClient,
  createSecureSyncErrorEnvelope,
  createSyncMetricsRegistry,
  createSyncScheduler,
  createTursoHttpClient,
  createTursoManager,
  createTursoSyncClient,
  deserializeMemoryState,
  redactSyncSecrets,
  resolveConflict,
  serializeMemoryState,
  TursoManager,
  validateCredentialSource,
  validateRemoteSnapshot,
  verifyBackupManifest,
  verifySyncChecksum,
  type BackupManager,
  type BackupManagerOptions,
  type BackupManifest,
  type BackupSnapshot,
  type ConflictRecord,
  type ConflictResolutionResult,
  type ConflictStore,
  type CredentialSource,
  type FileConflictStoreOptions,
  type MemoryState,
  type MemoryStateAdapter,
  type MemoryStateAdapterOptions,
  type MemorySyncTier,
  type MergePolicy,
  type RemoteValidationResult,
  type RestoreResult,
  type RestoreSnapshotOptions,
  type SecureSyncErrorEnvelope,
  type SecureSyncErrorOptions,
  type SyncError,
  type SyncManagerLike,
  type SyncMetrics,
  type SyncMetricsRegistry,
  type SyncMetricsRegistrySnapshot,
  type SyncMode,
  type SyncRecord,
  type SyncRunResult,
  type SyncScheduler,
  type SyncSchedulerOptions,
  type SyncSnapshot,
  type SyncStatus,
  type TursoClient,
  type TursoHttpClientConfig,
  type TursoSyncClientConfig,
  type TursoSyncConfig,
  type TursoUploadResult
} from './sync/index.js';
export {
  createMemoryCaptureTool,
  type CapturedMemoryRecord,
  type MemoryCaptureInput,
  type MemoryCaptureResult,
  type MemoryCaptureTool,
  type MemoryCaptureToolDeps
} from './tools/memory-capture.js';
export {
  createMemoryLintTool,
  type MemoryLintInput,
  type MemoryLintIssue,
  type MemoryLintResult,
  type MemoryLintTool,
  type MemoryLintToolDeps
} from './tools/memory-lint.js';
export {
  createMemoryListTool,
  type MemoryListInput,
  type MemoryListResult,
  type MemoryListTool,
  type MemoryListToolDeps
} from './tools/memory-list.js';
export {
  createMemorySearchTool,
  type MemorySearchTool,
  type MemorySearchToolDeps,
  type MemorySearchToolInput,
  type MemorySearchToolResult
} from './tools/memory-search.js';
export {
  createMemoryStatsTool,
  type MemoryStats,
  type MemoryStatsTool,
  type MemoryStatsToolDeps
} from './tools/memory-stats.js';
export { createContentProcessor, type ContentProcessor } from './wiki/content-processor.js';
export {
  createEntityExtractor,
  type EntityExtractionResult,
  type EntityExtractor,
  type EntityKind,
  type EntityRelationship,
  type ExtractedEntity
} from './wiki/entity-extractor.js';
export {
  createLocalEmbeddingEngine,
  type LocalEmbeddingEngine,
  type LocalEmbeddingEngineOptions
} from './wiki/local-embedding-engine.js';
export { createNavigationSystem, type NavigationSystem } from './wiki/navigation-system.js';
export { createVersionTracker, type VersionTracker } from './wiki/version-tracker.js';
export {
  createWikiManager,
  type ConceptRelation,
  type PageDiff,
  type RawCapture,
  type RawCaptureInput,
  type RawSourceType,
  type VectorEntry,
  type VectorSearchResult,
  type WikiManager,
  type WikiManagerDependencies,
  type WikiPage,
  type WikiPageHistoryEntry,
  type WikiPageInput
} from './wiki/wiki-manager.js';

export interface MemoryRecord {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStore {
  put(record: MemoryRecord): void;
  get(id: string): MemoryRecord | undefined;
  list(): MemoryRecord[];
}

export function createMemoryStore(): MemoryStore {
  const records = new Map<string, MemoryRecord>();

  return {
    get(id) {
      return records.get(id);
    },
    list() {
      return [...records.values()];
    },
    put(record) {
      records.set(record.id, record);
    }
  };
}

// Phase 4 — AgentFS, content-addressing
export * from './content-addressing/index.js';
export * from './filesystem/agentfs/audit-trail.js';
export * from './filesystem/agentfs/kv-store.js';
export * from './filesystem/agentfs/manager.js';
export * from './filesystem/agentfs/snapshots.js';

// Phase 1 v2 — Cognitive tier engine
export * from './cognitive/index.js';

// Phase 6 — MCP server surface
export * from './mcp/index.js';

// Phase 7 — Lifecycle hooks
export {
  onSessionStart,
  type OnSessionStartInput,
  type OnSessionStartOutput,
  onSessionEnd,
  type OnSessionEndInput,
  type OnSessionEndOutput,
  onToolCall,
  type OnToolCallInput,
  type OnToolCallOutput,
  onResponse,
  type OnResponseInput,
  type OnResponseOutput
} from './hooks/index.js';

// Phase 5 — Unified query interface
export { queryUnified, type UnifiedMemoryQuery, type UnifiedMemoryResult } from './unified-query.js';

// Phase 7 — Configuration & initialization
export { loadConfig, DEFAULT_TIER_CONFIGS, type MemoryConfig } from './config.js';
export {
  initMemory,
  type InitOptions,
  type InitResult,
  type InitResultWithServer,
  type InitResultWithoutServer
} from './init.js';
