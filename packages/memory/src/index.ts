// @agentsy/memory — Three-layer memory engine (raw event log, synthesized wiki, vector retrieval)
// Phase 1 foundation: coordination contracts + three-tier wiki primitives.

export {
  createContextFingerprint,
  createMemoryReuseHint,
  type ContextFingerprint,
  type CreateContextFingerprintInput,
  type CreateMemoryReuseHintInput,
  type MemoryReuseHint,
} from './types.js';

export {
  loadHonkerExtension,
  type HonkerLoadFeatures,
  type HonkerLoadOptions,
  type HonkerLoadResult,
} from './coordination/honker/loader.js';
export { rankReusableMemoryBlocks, type ReusableMemoryBlock } from './reuse.js';
export {
  createInMemoryPubSubManager,
  type ChannelListener,
  type PubSubManager,
} from './coordination/pub-sub-manager.js';
export { createInMemoryScheduler, type Scheduler } from './coordination/scheduler.js';
export { createInMemoryTaskQueue, type CoordinationTask, type TaskQueue } from './coordination/task-queue.js';
export {
  createLocalEmbeddingEngine,
  type LocalEmbeddingEngine,
  type LocalEmbeddingEngineOptions,
} from './wiki/local-embedding-engine.js';
export { createContentProcessor, type ContentProcessor } from './wiki/content-processor.js';
export { createNavigationSystem, type NavigationSystem } from './wiki/navigation-system.js';
export { createVersionTracker, type VersionTracker } from './wiki/version-tracker.js';
export {
  createWikiManager,
  type RawCapture,
  type RawCaptureInput,
  type RawSourceType,
  type ConceptRelation,
  type PageDiff,
  type VectorEntry,
  type VectorSearchResult,
  type WikiManager,
  type WikiManagerDependencies,
  type WikiPage,
  type WikiPageHistoryEntry,
  type WikiPageInput,
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
    put(record) {
      records.set(record.id, record);
    },
    get(id) {
      return records.get(id);
    },
    list() {
      return [...records.values()];
    },
  };
}
