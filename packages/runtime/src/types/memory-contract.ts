/**
 * Memory contract interface for agentic context system.
 * Abstract interface for memory providers, retrievers, lifecycle hooks, and summarization.
 * Must be pluggable so consumers can substitute their own memory backend.
 */
export interface MemoryContract {
  /**
   * Store a memory entry with optional metadata.
   */
  store(entry: MemoryEntry): Promise<MemoryId>;

  /**
   * Retrieve a memory entry by ID.
   */
  retrieve(memoryId: MemoryId): Promise<MemoryEntry | null>;

  /**
   * Query memories by semantic similarity.
   */
  query(query: string, options?: MemoryQueryOptions): Promise<MemoryQueryResult>;

  /**
   * Update an existing memory entry.
   */
  update(memoryId: MemoryId, updates: Partial<MemoryEntry>): Promise<void>;

  /**
   * Delete a memory entry.
   */
  delete(memoryId: MemoryId): Promise<void>;

  /**
   * List all memory IDs in the store.
   */
  list(): Promise<MemoryId[]>;

  /**
   * Clear all memories.
   */
  clear(): Promise<void>;

  /**
   * Get memory statistics.
   */
  stats(): Promise<MemoryStats>;
}

export type MemoryId = string;

export interface MemoryEntry {
  id: MemoryId;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  timestamp: string;
  tags?: string[];
}

export interface MemoryQueryOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, unknown>;
}

export interface MemoryQueryResult {
  entries: Array<{
    entry: MemoryEntry;
    score: number;
  }>;
  total: number;
}

export interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  tags: string[];
  lastUpdated: string;
}

/**
 * Summary-only memory interface for views/glimpses functionality.
 */
export interface MemorySummary {
  summaries: Array<{
    summary: string;
    entryCount: number;
    timestampRange: { start: string; end: string };
  }>;
}

/**
 * Memory lifecycle hooks for integration with agent loop.
 */
export interface MemoryLifecycleHooks {
  /**
   * Hook called before storing a memory entry.
   */
  beforeStore?: (entry: MemoryEntry) => Promise<MemoryEntry>;

  /**
   * Hook called after storing a memory entry.
   */
  afterStore?: (entry: MemoryEntry) => Promise<void>;

  /**
   * Hook called before querying memories.
   */
  beforeQuery?: (
    query: string,
    options?: MemoryQueryOptions,
  ) => Promise<{ query: string; options?: MemoryQueryOptions }>;

  /**
   * Hook called after querying memories.
   */
  afterQuery?: (result: MemoryQueryResult, query: string, options?: MemoryQueryOptions) => Promise<MemoryQueryResult>;

  /**
   * Hook called before deleting a memory entry.
   */
  beforeDelete?: (memoryId: MemoryId) => Promise<boolean>;

  /**
   * Hook called after deleting a memory entry.
   */
  afterDelete?: (memoryId: MemoryId) => Promise<void>;
}

/**
 * Provider interface for embedding generation.
 */
export interface EmbeddingProvider {
  /**
   * Generate embedding for a single text.
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch).
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get embedding dimension.
   */
  dimension: number;

  /**
   * Get embedding model name.
   */
  model: string;
}

/**
 * Retriever interface for semantic search.
 */
export interface MemoryRetriever {
  /**
   * Retrieve relevant memories for a query.
   */
  retrieve(query: string, options?: MemoryQueryOptions): Promise<MemoryQueryResult>;

  /**
   * Get retrieval configuration.
   */
  getConfig(): RetrievalConfig;
}

export interface RetrievalConfig {
  limit: number;
  threshold: number;
  embeddingModel: string;
}

/**
 * Conversation summarization interface.
 */
export interface ConversationSummarizer {
  /**
   * Summarize conversation messages.
   */
  summarize(messages: Array<{ role: string; content: string }>, options?: SummarizationOptions): Promise<string>;

  /**
   * Generate hierarchical summaries.
   */
  summarizeHierarchical(
    messages: Array<{ role: string; content: string }>,
    depth: number,
  ): Promise<
    Array<{
      level: number;
      summary: string;
    }>
  >;
}

export interface SummarizationOptions {
  maxLength?: number;
  format?: 'narrative' | 'bullet' | 'structured';
  preserveKeyPoints?: boolean;
}

/**
 * Memory provider factory for pluggable backends.
 */
export interface MemoryProviderFactory {
  /**
   * Create a memory contract instance from configuration.
   */
  create(config: MemoryProviderConfig): Promise<MemoryContract>;

  /**
   * Validate configuration.
   */
  validateConfig(config: MemoryProviderConfig): boolean;

  /**
   * Get supported features.
   */
  getFeatures(): string[];
}

export interface MemoryProviderConfig {
  type: string;
  connectionString?: string;
  apiKey?: string;
  options?: Record<string, unknown>;
}

/**
 * Memory injection detection for safety events.
 */
export interface MemoryInjectionDetector {
  /**
   * Detect potential memory injection in memories.
   */
  detectInjection(entry: MemoryEntry): InjectionDetectionResult;

  /**
   * Scan all memories for injection patterns.
   */
  scanMemories(): Promise<InjectionDetectionResult[]>;
}

export interface InjectionDetectionResult {
  isSuspected: boolean;
  severity: 'low' | 'medium' | 'high';
  detectionSource: 'pattern' | 'volume' | 'structure';
  evidence: string[];
}

/**
 * Memory view/glimpse interface for hierarchical summaries.
 */
export interface MemoryView {
  /**
   * Generate memory summary view.
   */
  getSummary(timeRange?: { start: string; end: string }): Promise<MemorySummary>;

  /**
   * Get detailed memory entries.
   */
  getEntries(filter?: Record<string, unknown>): Promise<MemoryEntry[]>;

  /**
   * Get memory timeline view.
   */
  getTimeline(): Promise<MemoryTimeline>;
}

export interface MemoryTimeline {
  entries: Array<{
    timestamp: string;
    entryCount: number;
    tags: string[];
  }>;
}
