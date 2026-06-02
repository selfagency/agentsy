---
goal: @agentsy/memory production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: memory-maintainers
status: In progress
tags: [feature, architecture, memory, retrieval, knowledge]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/memory` with deterministic capture, retrieval, injection, and long-horizon knowledge behavior.

## 1. Requirements & Constraints

- **REQ-MEMORY-001**: Memory capture supports episodic, semantic, and procedural classes with clear promotion rules.
- **REQ-MEMORY-002**: Retrieval/injection follows deterministic XML/tagged context contracts and budget-aware packing.
- **REQ-MEMORY-003**: Scope isolation across user/workspace/project/session contexts is enforced.
- **REQ-MEMORY-004**: Cache-aware reuse and context compression integrate with `@agentsy/core`, `@agentsy/runtime`, and `@agentsy/context`.
- **REQ-MEMORY-005**: Memory workflows are observable and auditable with redacted traces.
- **SEC-MEMORY-001**: Sensitive memory fields support redaction/encryption and selective recall restrictions.
- **SEC-MEMORY-002**: Imported/synced memory content requires provenance validation.
- **CON-MEMORY-001**: Session durability remains in `@agentsy/session`; memory owns durable knowledge.
- **CON-MEMORY-002**: Orchestration/planning strategy remains in `@agentsy/orchestrator`.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-MEMORY-001: Contract and scope stabilization.

| Task            | Description                                                                       | Completed | Date       |
| --------------- | --------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-MEMORY-001 | Stabilize memory record schemas, scope manager contracts, and promotion taxonomy. | ✅        | 2026-05-15 |
| TASK-MEMORY-002 | Finalize retrieval/injection envelope and XML context insertion contract.         | ✅        | 2026-05-15 |
| TASK-MEMORY-003 | Document ownership boundaries vs session/retrieval/runtime packages.              | ✅        | 2026-05-17 |

### Implementation Phase 2

- GOAL-MEMORY-002: Core memory subsystem completion.

| Task            | Description                                                                            | Completed | Date       |
| --------------- | -------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-MEMORY-004 | Complete capture/retrieval/reuse modules and scope-aware storage behavior.             | ✅        | 2026-05-15 |
| TASK-MEMORY-005 | Implement cache-aware context segment reuse and invalidation logic.                    | ✅        | 2026-05-15 |
| TASK-MEMORY-006 | Implement memory tools (`search`, `list`, `stats`, `lint`, capture) and policy checks. | ✅        | 2026-05-17 |

### Implementation Phase 3

- GOAL-MEMORY-003: Runtime/session/retrieval integration.

| Task            | Description                                                                 | Completed | Date       |
| --------------- | --------------------------------------------------------------------------- | --------- | ---------- |
| TASK-MEMORY-007 | Integrate runtime post-turn capture and pre-turn retrieval injection hooks. | ✅        | 2026-05-17 |
| TASK-MEMORY-008 | Validate session continuity and replay with memory-aware context behavior.  | ✅        | 2026-05-17 |
| TASK-MEMORY-009 | Add integration and benchmark coverage for quality/cost improvements.       | ✅        | 2026-05-17 |

### Implementation Phase 4

- GOAL-MEMORY-004: Hardening and release gates.

| Task            | Description                                                            | Completed | Date       |
| --------------- | ---------------------------------------------------------------------- | --------- | ---------- |
| TASK-MEMORY-010 | Add failure-mode tests for corruption, stale cache, and scope leakage. | ✅        | 2026-05-17 |
| TASK-MEMORY-011 | Align docs/examples with shipped memory workflows.                     | ✅        | 2026-05-17 |
| TASK-MEMORY-012 | Pass monorepo release gates and package-quality thresholds.            | ✅        | 2026-05-17 |

## 3. Acceptance Criteria

- **ACC-MEMORY-001**: Deterministic memory injection and scope isolation are test-validated.
- **ACC-MEMORY-002**: Runtime/session/retrieval integrations pass end-to-end tests.
- **ACC-MEMORY-003**: Performance/cost improvements and safety constraints are documented and reproducible.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/feature-memory-token-reduction-phase0-1.md`
- `plan/feature-memory-foundation-phase1-1.md`
- `plan/feature-memory-turso-sync-phase2-1.md`
- `plan/feature-memory-rag-enhancement-phase3-1.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `plan/2026-05-15-cache-aware-context-reuse.md`
- `packages/memory/README.md`
- `packages/memory/MEMORY-ARCHITECTURE.md`
- `packages/memory/MEMORY-STRATEGY-SYNTHESIS.md`
- `packages/memory/MEMORY-REVIEW.md`
- `packages/memory/UPDATED-IMPLEMENTATION-PLAN.md`
- `packages/memory/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/memory — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/memory` is the **long-term brain** of the framework. It manages the transition of information from ephemeral stream chunks into structured, persistent knowledge. It provides the storage and retrieval mechanisms that allow agents to "remember" facts, past interactions, and learned procedures across sessions.

It integrates deeply with `@agentsy/runtime` for active context management and `@agentsy/session` for cross-session continuity.

### Ecosystem Sketch

```text
[ @agentsy/runtime ] <--- Context Injection
         |
         v
[ @agentsy/memory ] <--- Storage & Retrieval
         |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
 [ Semantic Store ]      [ Episodic Store ]      [ Procedural Store ]
 (Facts/Wiki)            (Events/Logs)           (Skills/Routines)
         |                       |                       |
         +-----------+-----------+-----------+-----------+
                     |
                     v
             [ SQLite / Vector DB ]
```

## Fulfillment of Role

The package fulfills its role by implementing a hierarchical memory model:

1. **Sensory Memory**: Raw, unfiltered stream buffer (last N tokens).
2. **Working Memory**: The active context window (managed via `@agentsy/runtime`).
3. **Semantic Memory**: Long-term facts and concepts (Karpathy-style wiki pages).
4. **Episodic Memory**: Timestamped events and session histories.
5. **Procedural Memory**: Learned skills and executable patterns.

## Detailed Functionality

### 1. Memory Store (`src/store/`)

- **Wiki Invariant**: Vector RAG MUST index synthesized wiki pages, NOT raw session events (REQ-017).
- **CRUD API**: White-box editing for reading, creating, updating, and deleting individual entries.

### 2. Retrieval & Injection (`src/retrieval/`)

- **Context Injection**: Retrieved memory context injected via `<memory_context>` tags using existing `splitLeadingXmlContext`/`dedupeXmlContext` pipeline (REQ-019).
- **Tools**: Expose `memory_search()`, `memory_capture()`, `memory_list()`, `memory_stats()`, `memory_lint()` to agent loop (REQ-018).

### 3. Memory Scopes (`src/scope/`)

- **Responsibility**: Isolation and access control.
- **Scopes**:
  - `session`: Only available to the current agent session.
  - `user`: Global to the user across all projects.
  - `project`: Shared across agents within a single codebase.
  - `team`: Shared across a declared group of agents (requires trust model).
  - `global`: Universally available.

### Task and todo boundary clarification

- `@agentsy/memory` is not the source of truth for the active task manager or current checklist state.
- honker queue and time-trigger scheduling primitives may be used here as coordination infrastructure, but not as the domain owner of task semantics.
- Memory should store only promoted durable task knowledge: completed-task summaries, learned procedures, explicit user-pinned backlog items, and long-lived project reminders.
- Active per-run todos/checklists belong to orchestrator and are snapshotted by session.
- Enforce a clear boundary between session state (transient, in-memory, per-conversation) and memory (durable, persisted, cross-session). Auto-compaction operates on session state; memory layer is updated post-turn independently.

### 4. Synthesis & Compression (`src/synthesis/`)

- **Mechanism**: Periodic review of episodic logs to generate or update semantic wiki pages.
- **Goal**: 75-99% token reduction in long-running sessions via tree-based navigation and delta versioning (RemindB pattern).
- During compaction, entries are ranked by semantic relevance to the current session context, not by recency. The semantic ranker uses embedding similarity against recent session context.

### 5. Cache-aware memory reuse (LMCache-inspired)

LMCache’s most useful idea for `@agentsy/memory` is not GPU-specific cache plumbing; it is the concept of **reusable context artifacts** with explicit reuse and invalidation rules.

#### What to adapt

- **Reusable context fingerprints** for stable memory blocks, system preambles, tool schemas, and synthesized wiki pages.
- **Hot / warm / cold memory tiers** that reflect retrieval frequency and recency.
- **Cache eligibility metadata** so the runtime can tell which context fragments are safe to reuse across turns or sessions.
- **Hit/miss accounting** for context assembly so we can measure whether memory is actually reducing prompt cost.

#### What not to overfit from LMCache

- Do not hardcode GPU-only or vLLM-specific KV cache internals into memory storage.
- Do not require a distributed cache backend before the abstraction is useful.
- Do not store raw chat as the primary unit of reuse; reuse synthesized blocks and stable context segments instead.

#### Recommended memory-layer guidance

1. Introduce a `ContextFingerprint` concept for memory blocks, prompt segments, and wiki pages.
2. Mark entries with reuse hints like `stablePrefix`, `toolSchema`, `conversationSummary`, and `sessionCheckpoint`.
3. Track invalidation triggers for model changes, prompt-template changes, tool-schema changes, and user edits.
4. Add cache-aware retrieval that prefers a previously assembled block when its fingerprint and invalidation keys still match.
5. Surface cache hit rate and reuse distance in memory observability.

## Logic & Data Flow

### 1. Memory Injection Flow

1. At turn start, `@agentsy/runtime` requests context from `@agentsy/memory`.
2. Memory performs a `search` based on the current goal and message history.
3. Relevant entries are formatted as XML (e.g., `<memory_context>`) and injected into the system prompt.
4. The LLM processes the turn with the injected context.

### 2. Learning Flow (Consolidation)

1. After a session ends or reaches a milestone, `MemoryManager.consolidate()` is triggered.
2. The system reviews the `Episodic` event logs for that session.
3. New facts are extracted and added to `Semantic` memory.
4. Redundant or contradictory entries are resolved or merged (SwarmVault pattern).

## Key Interfaces

### MemoryStore

```typescript
export interface MemoryStore {
  write(entry: MemoryEntry): Promise<MemoryId>;
  read(id: MemoryId): Promise<MemoryEntry | undefined>;
  search(query: MemoryQuery): Promise<RetrievalResult[]>;
  delete(id: MemoryId): Promise<void>;
  compact(): Promise<void>;
}
```

Memory layer registers a PreCompact hook handler that the runtime calls before each compact cycle. The handler evaluates which memory entries to retain vs discard based on relevance scoring.

### MemoryEntry

```typescript
export interface MemoryEntry {
  id: MemoryId;
  type: "semantic" | "episodic" | "procedural";
  scope: MemoryScope;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  importance: number; // 0.0 to 1.0 (attention ranking)
  createdAt: Date;
  expiresAt?: Date;
}
```

## Implementation Details

### Injection Safety

All content retrieved from memory must be treated as untrusted input. The system must sanitize entries for prompt injection patterns before splicing them into the system prompt.

### Karpathy Wiki

The "wiki" is the primary source of semantic knowledge. Instead of indexing raw chat messages, we index synthesized summaries (wiki pages) that group related facts.

## Sources Synthesized

`agentsy-prd.md`, `agentsy-deep-dive-v2.md`, `agentsy-tech.md`, `agentsy-testing-plan.md`, `owasp-security-testing-1.md`, `packages/memory/IMPLEMENTATION-PLAN.md`.

- **Message Buffer Architecture** - Perpetual thread for conversation continuity
- **Memory Blocks System** - Editable, pinned context units with APIs
- **Recall vs Archival Separation** - Raw history vs processed knowledge
- **Sleep-Time Compute** - Asynchronous memory management and optimization
- **MemGPT OS Approach** - Hierarchical memory tiers (RAM vs disk analogy)
- **Smart Eviction Policies** - Intelligent context window management

### Enhanced Features Beyond Individual Libraries

#### Context Engineering Architecture (New)

- **Dynamic Context Composition** - System that assembles context pre-LLM call
- **Right Information, Right Time** - Context failure prevention through comprehensive information gathering
- **Format Optimization** - Concise summaries over raw data dumps, clear tool schemas
- **Cross-Functional Context System** - Business-aware context engineering

#### Memory Block Management (Letta-inspired)

- **Editable Memory Blocks** - Structured, API-managed context units
- **Agent Self-Management** - Agents can update their own memory blocks
- **Specialized Memory Agents** - Sleep-time agents for asynchronous optimization
- **Context Rewriting** - Improved context window organization over time

#### Cross-Session Persistence

- Memory continuity across different agent sessions
- Agent-specific memory isolation vs shared knowledge bases
- Memory inheritance patterns (team → project → user → personal)

#### Development Workflow Integration

- IDE context awareness (Cursor, VS Code, Claude Code integration)
- Build system and toolchain integration
- Code review and PR history as memory sources
- Documentation as first-class memory content

#### Advanced Search & Retrieval (SQLite + Vector Enhanced)

- **Multi-signal fusion** - Semantic + BM25 + entity + temporal signals
- **Adaptive routing** - Learning-based result prioritization
- **Evidence classes** - Tagged by confidence level and extraction method
- **Budget-aware retrieval** - Token-bounded, context-scoped, evidence-backed
- **SQLite + Vector hybrid search** - SQL precision + vector similarity (inspired by SQLite.ai, turso.tech)
- **Document indexing pipeline** - File, web, and conversation indexing (like sqlite-ollama-rag, sourcebot)
- **Context-aware memory retrieval** - Project structure, dependencies, and conversation context
- **Real-time indexing** - Live document updates with FTS5 and vector embeddings

#### Document Indexing & Context Building

- **Multi-modal indexing** - Code, documentation, web content, conversations
- **Semantic chunking** - Intelligent content segmentation for vector storage
- **Dependency graph tracking** - Code relationships and import analysis
- **Project structure awareness** - File tree, package structure, and build system
- **Conversation checkpointer** - Multi-turn context persistence (like agentic RAG checkpointer)
- **Live file watching** - Real-time updates and reindexing
- **Cross-repository knowledge** - Shared patterns and conventions

#### Learning & Adaptation (Enhanced)

- **Interaction-based feedback loops** - Continuous improvement from user interactions
- **Pattern recognition** - Detect recurring patterns in information usage
- **Preference learning** - Personalized retrieval and organization
- **Skill acquisition** - Learn from user feedback and examples
- **Sleep-Time Optimization** - Asynchronous memory refinement during idle periods
- **Proactive Memory Refinement** - Memory reorganization and improvement during downtime
- **Temperature-Based Learning** - Hot/cold memory tracking for adaptive retrieval

#### Context Window Management (New Critical Feature)

- **Intelligent Eviction Strategies** - Smart context window overflow management
- **Recursive Summarization** - Progressive summarization of evicted content
- **Partial Eviction** - Only evict 70% to maintain conversation continuity
- **Context Budget Optimization** - Token-aware context allocation

### Implementation Strategy

### Core Responsibilities (Enhanced with Research Insights)

- **Hierarchical memory storage** with memory-type-aware tiers (sensory → working → short-term → long-term → permanent → archival)
- **Semantic similarity search and clustering** across all memory types with temperature tracking
- **Automatic memory summarization and compression** with recursive content preservation
- **Context-aware memory retrieval** through dynamic context engineering
- **Memory relationship graph management** with semantic and episodic connections
- **Continuous learning and forgetting** with sleep-time optimization and preference adaptation
- **Multi-modal memory support** for semantic, episodic, and procedural content types
- **Context window management** with intelligent eviction and memory block organization
- **Sleep-time asynchronous optimization** for memory quality improvement and maintenance
- **Cross-session memory continuity** with agent personality and knowledge persistence

### Context Engineering First Principle

- **Memory IS context management** - All memory operations serve better context composition
- **Right information, right time** - Prevent context failures through comprehensive information gathering
- **Dynamic context assembly** - System that builds optimal context before LLM calls
- **Context quality assurance** - Validate completeness, relevance, and format before use

### Memory Type Architecture

Following cognitive science research and Letta's agent memory insights:

- **Semantic Memory**: Facts, concepts, and relationships (knowledge base)
- **Episodic Memory**: Specific events, experiences, and conversations with timestamps
- **Procedural Memory**: Skills, routines, and learned processes (executable patterns)
- **Working Memory**: Active context window - immediate task focus
- **Sensory Memory**: Raw, unfiltered input buffer for immediate processing

### Performance and Scalability Principles

- **SQLite + Vector hybrid approach** leveraging sqlite-ollama-rag patterns
- **Token efficiency goals** of 75-99% reduction in agent sessions through smart context
- **Hierarchical storage strategy** matching memory access patterns to storage costs
- **Sleep-time compute optimization** using idle periods for memory improvement
- **Context window management** with intelligent eviction and recursive summarization
- **Reusable context artifacts** with fingerprinted hot/warm/cold tiers and explicit invalidation

### Architecture Inspired By

#### Memelord (<https://github.com/glommer/memelord>)

- Hierarchical memory organization
- Semantic search capabilities
- Memory compression concepts

#### OB1 (<https://github.com/NateBJones-Projects/OB1>)

- Advanced relationship graph management
- Context-aware retrieval
- Memory clustering organization

#### Karpathy's Concepts (<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>)

- Memory as attention mechanism
- Forgetting and compression principles
- Retrieval-augmented generation patterns

#### CoG (<https://github.com/marciopuga/cog>)

- Continuous learning mechanisms
- Memory consolidation strategies
- Adaptive chunking approaches

### Public API Design

```typescript
// Memory hierarchy tiers (Enhanced with research insights)
export enum MemoryTier {
  SENSORY = "sensory", // Raw input buffer (seconds to minutes)
  WORKING = "working", // Active context window (hours)
  SHORT_TERM = "short-term", // Message buffer + recent memories (days)
  LONG_TERM = "long-term", // Semantic + episodic consolidated (months)
  PERMANENT = "permanent", // Core procedural knowledge (years)
  ARCHIVAL = "archival", // External database storage (indefinite)
}

// Memory types based on cognitive science research
export enum MemoryType {
  SEMANTIC = "semantic", // Facts, concepts, relationships
  EPISODIC = "episodic", // Events, experiences, conversations
  PROCEDURAL = "procedural", // Skills, routines, processes
  WORKING = "working", // Active context window content
  SENSORY = "sensory", // Raw, unfiltered input
}

// Memory entry with rich metadata (Enhanced)
export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  type: MemoryType;
  content: MultiModalContent;
  embedding: VectorEmbedding;
  relationships: MemoryRelationship[];
  context: ConversationContext;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  summary?: string;
  tags: string[];
  importance: number;
  decayRate: number;
  // New fields from research insights
  temperature: "hot" | "warm" | "cold"; // Access frequency indicator
  compressionRatio?: number; // For summarized content
  consolidationLevel: number; // Processing depth (0-raw, 10-permanent)
  editHistory: MemoryEdit[]; // Track changes over time
  retrievalScore?: number; // Context relevance score
  contextWindowPosition?: number; // Current position in context
  associatedBlocks?: string[]; // Memory block associations
}

// Multi-modal content support
export interface MultiModalContent {
  type: "text" | "image" | "audio" | "code" | "structured" | "conversation";
  data: unknown;
  metadata: {
    mimeType?: string;
    duration?: number;
    tokens?: number;
    confidence?: number;
  };
}

// Memory manager (Enhanced with context engineering)
export interface MemoryManager {
  // Storage and retrieval
  store(content: MultiModalContent, options?: StorageOptions): Promise<MemoryEntry>;
  retrieve(query: MemoryQuery, options?: RetrievalOptions): Promise<MemoryEntry[]>;

  // Context engineering functions (NEW)
  buildContext(task: TaskDescription, constraints: ContextConstraints): Promise<BuildContextResult>;
  manageContextWindow(context: BuildContextResult, budget: TokenBudget): Promise<ManagedContext>;
  optimizeContext(context: ManagedContext, feedback: QualityFeedback): Promise<OptimizedContext>;

  // Memory block management (NEW)
  createMemoryBlock(label: string, description: string, limit: number): Promise<MemoryBlock>;
  updateMemoryBlock(blockId: string, content: string): Promise<void>;
  pinToContext(blockId: string, priority: number): Promise<void>;
  rewriteContext(criteria: RewriteCriteria): Promise<RewriteResult>;

  // Memory lifecycle
  promote(memoryId: string, targetTier: MemoryTier): Promise<void>;
  decay(memoryId: string, factor?: number): Promise<void>;
  consolidate(criteria: ConsolidationCriteria): Promise<ConsolidationResult>;
  evictFromContext(evictionPolicy: EvictionPolicy): Promise<EvictionResult>;

  // Search and exploration
  semanticSearch(query: string, options?: SearchOptions): Promise<MemoryEntry[]>;
  similaritySearch(embedding: VectorEmbedding, options?: SearchOptions): Promise<MemoryEntry[]>;
  contextualSearch(context: ConversationContext): Promise<MemoryEntry[]>;
  typeSearch(memoryType: MemoryType, query: string): Promise<MemoryEntry[]>;
  temperatureSearch(temperature: MemoryTemperature): Promise<MemoryEntry[]>;

  // Memory relationships
  addRelationship(from: string, to: string, type: RelationshipType): Promise<void>;
  findRelated(memoryId: string, options?: RelatedOptions): Promise<MemoryEntry[]>;
  exploreGraph(startId: string, options?: GraphOptions): Promise<MemoryGraph>;

  // Learning and adaptation
  learn(interaction: LearningInteraction): Promise<void>;
  getRecommendations(context: ConversationContext): Promise<MemoryRecommendation[]>;
  optimize(criteria: OptimizationCriteria): Promise<OptimizationResult>;

  // Sleep-time compute (NEW)
  scheduleSleepProcessing(schedule: SleepSchedule): Promise<void>;
  optimizeMemoryDuringSleep(criteria: SleepOptimizationCriteria): Promise<SleepResult>;
  consolidateDuringSleep(timeBudget: TimeBudget): Promise<ConsolidationResult>;
}

// Automatic summarization and compression
export interface MemoryCompressor {
  summarize(memory: MemoryEntry[]): Promise<string>;
  compress(memory: MemoryEntry[], targetSize?: number): Promise<MemoryEntry[]>;
  extractKeyPoints(content: MultiModalContent): Promise<string[]>;
  generateRelations(memories: MemoryEntry[]): Promise<MemoryRelationship[]>;
}

// Context-aware retrieval
export interface ContextualRetriever {
  retrieveByContext(context: ConversationContext): Promise<ContextualResult>;
  getRelevanceScore(memory: MemoryEntry, context: ConversationContext): Promise<number>;
  buildRetrievalProfile(context: ConversationContext): Promise<RetrievalProfile>;
}

// Continuous learning system (Enhanced)
export interface LearningEngine {
  processInteraction(interaction: LearningInteraction): Promise<void>;
  updateEmbeddings(memoryIds: string[]): Promise<void>;
  improveRetrieval(feedback: RetrievalFeedback): Promise<void>;
  detectPatterns(): Promise<MemoryPattern[]>;

  // Context engineering learning (NEW)
  learnFromContextFailures(failures: ContextFailure[]): Promise<void>;
  optimizeContextBuilding(usage: ContextUsage[]): Promise<OptimizationResult>;
  learnContentPreference(feedback: ContentFeedback): Promise<PreferenceProfile>;

  // Sleep-time learning (NEW)
  scheduleSleepProcessing(schedule: SleepSchedule): Promise<void>;
  optimizeMemoryDuringSleep(criteria: SleepOptimizationCriteria): Promise<SleepResult>;
  performMemoryMaintenance(maintenanceTasks: MaintenanceTask[]): Promise<MaintenanceResult>;
}

// New interfaces from research insights
export interface MemoryBlock {
  id: string;
  label: string;
  description: string;
  value: string;
  characterLimit: number;
  isEditable: boolean;
  isPinned: boolean;
  priority: number;
  content: MultiModalContent;
}

export interface ContextConstraints {
  maxTokens: number;
  timeLimit: number;
  tools: string[];
  requirements: string[];
  preferences: UserPreferences;
}

export interface BuildContextResult {
  context: string;
  memories: MemoryEntry[];
  tools: ToolDefinition[];
  requirements: string[];
  tokenCount: number;
  estimatedQuality: number;
}

export interface TokenBudget {
  allocation: number;
  used: number;
  reserved: number;
  available: number;
}

export interface EvictionPolicy {
  strategy: "importance" | "temperature" | "recency" | "hybrid";
  preservePercentage: number;
  targetReduction: number;
}

export type MemoryTemperature = "hot" | "warm" | "cold";

export interface SleepOptimizationCriteria {
  timeBudget: number;
  focusAreas: MemoryType[];
  objectives: OptimizationObjective[];
  qualityThreshold: number;
}
```

### Implementation Strategy

#### Enhanced Hierarchical Memory Storage (Research-Backed)

```typescript
// Memory tiers with Letta-inspired architecture
const memoryTiers = {
  // Sensory memory - raw input buffer
  sensory: {
    store: new InMemoryStore({ maxSize: 100, ttl: "5m" }),
    evictionPolicy: "fifo",
    compression: false,
  },

  // Working memory - active context window
  working: {
    store: new InMemoryStore({ maxSize: 10000, ttl: "4h" }),
    blockManagement: new MemoryBlockManager(),
    contextWindowAware: true,
    smartEviction: new IntelligentEviction(),
  },

  // Short-term memory - message buffer + recent
  shortTerm: {
    store: new SQLiteStore({ path: "./short-term.db", maxSize: "50MB" }),
    includes: ["message_buffer", "recent_experiences"],
    vectorSearch: true,
    temperatureTracking: true,
  },

  // Long-term memory - semantic + episodic consolidated
  longTerm: {
    store: new SQLiteStore({ path: "./long-term.db", maxSize: "500MB" }),
    includes: ["semantic_knowledge", "episodic_memories"],
    vectorIndex: true,
    relationshipGraph: true,
    compression: "automatic",
  },

  // Permanent memory - procedural knowledge
  permanent: {
    store: new SQLiteStore({ path: "./permanent.db", maxSize: "2GB" }),
    includes: ["procedural_skills", "core_facts"],
    versioned: true,
    backupRequired: true,
  },

  // Archival memory - external database
  archival: {
    store: new VectorDBStore({ connectionString: process.env.VECTOR_DB }),
    includes: ["processed_knowledge", "indexed_content"],
    searchOptimized: true,
    scalable: true,
  },
};

// Context engineering system (NEW)
const contextEngineering = {
  builder: new ContextBuilder({
    informationGatherer: new RichContextGatherer(),
    formatter: new ContextFormatter(),
    validator: new ContextValidator(),
  }),
  windowManager: new ContextWindowManager({
    budgetManager: new TokenBudgetManager(),
    evictionStrategy: new SmartEvictionStrategy({ preservePercentage: 30 }),
    optimizer: new ContextOptimizer(),
  }),
  qualityAssurance: new ContextQualityAssurance({
    completenessChecker: new CompletenessChecker(),
    relevanceScorer: new RelevanceScorer(),
    formatOptimizer: new FormatOptimizer(),
  }),
};

// Sleep-time compute system (NEW)
const sleepTimeSystem = {
  scheduler: new SleepScheduler({
    idleDetection: new IdleDetector(),
    timeBudgetManager: new TimeBudgetManager(),
  }),
  memoryOptimizer: new MemoryOptimizer({
    consolidationEngine: new ConsolidationEngine(),
    relationshipRefiner: new RelationshipRefiner(),
    compressionEngine: new AdvancedCompressionEngine(),
  }),
  learningEngine: new SleepLearningEngine({
    patternDetector: new PatternDetector(),
    preferenceLearner: new PreferenceLearner(),
    feedbackProcessor: new FeedbackProcessor(),
  }),
};
```

#### Git Integration (from SwarmVault)

```typescript
// Git-backed memory with automatic sync
const gitIntegration = {
  autoCommit: true,
  hookType: ["pre-commit", "post-merge", "post-checkout"],
  conflictResolution: true,
  branchTracking: true,
  decisionLogging: true,
};
```

#### Semantic Search & Clustering

- Vector embeddings using OpenAI/Anthropic models
- FAISS-like similarity search optimization
- Automatic topic clustering
- Semantic relationship detection

#### Memory Compression (Coordinator concepts)

- Daily/weekly consolidation processes
- Hierarchical summarization
- Relationship preservation
- Importance-based retention

#### Context-Aware Retrieval (OB1 + Letta concepts)

- Conversation context vector with memory block integration
- Temporal context weighting with temperature-based prioritization
- Relationship graph traversal with semantic clustering
- Serendipitous discovery through related memory exploration
- **Dynamic context composition** - Right information at right time
- **Context failure prevention** - Comprehensive information gathering

#### Continuous Learning (CoG + Sleep-Time concepts)

- Interaction-based feedback loops with real-time adaptation
- Adaptive embedding updates with preference learning
- Retrieval pattern learning with quality feedback integration
- Automatic tagging improvement through semantic analysis
- **Asynchronous sleep-time optimization** - Memory refinement during downtime
- **Proactive memory consolidation** - Background organization and improvement

#### Memory Block Management (Letta concepts)

- Editable, API-managed memory blocks with character limits
- Agent self-management capabilities for context improvement
- Specialized memory agents for asynchronous optimization
- Context rewriting through structured memory block updates
- Pinned context units for persistent重要信息

#### Context Window Engineering (Letta + MemGPT concepts)

- Intelligent eviction strategies with recursive summarization
- Partial eviction policies (70% rule) for conversation continuity
- OS-style hierarchical memory management (RAM vs disk analogy)
- Smart context budget optimization with token-aware allocation
- Context window as working memory abstraction

### Dependencies

- Internal: `@agentsy/types` - Core interfaces
- Internal: `@agentsy/retrieval` - Vector search integration
- External: Vector databases (Weaviate/Pinecone/FAISS)
- External: Embedding models (OpenAI/Anthropic)
- External: Graph databases (Neo4j/ArangoDB)

### Test Strategy

- Multi-modal content handling tests
- Semantic search accuracy validation
- Memory lifecycle testing
- Performance benchmarks at scale
- Learning algorithm validation

### Co-development Dependencies

- `retrieval` - Vector search and indexing
- `session` - Context tracking
- `tools` - Memory manipulation tools
- `telemetry` - Memory usage analytics

### Source Plan References

- `plan/agentsy-memory.md` - Original memory system design
- `plan/agentsy-tech.md` §4.10 - Memory and retrieval architecture
- Memory system research papers and libraries

### Implementation Milestones

#### Phase 1: Core Memory System + Context Engineering Foundation

- [ ] Enhanced MemoryEntry with MemoryType and research-based fields
- [ ] Multi-tier storage implementation with SQLite + Vector hybrid
- [ ] Basic CRUD operations for all memory types
- [ ] Simple search functionality across memory types
- [ ] Multi-modal content support for semantic, episodic, procedural memory
- **[NEW]** ContextBuilder for dynamic context composition
- **[NEW]** MemoryBlock management system with API control
- **[NEW]** Basic context window management with smart eviction

#### Phase 2: Semantic Search & Context Engineering Optimization

- [ ] Vector embedding integration with multi-modal support
- [ ] Enhanced semantic search across all memory types
- [ ] Relationship graph foundation with temperature tracking
- [ ] Search optimization with context-aware scoring
- [ ] Index management for SQLite + Vector hybrid approach
- **[NEW]** Context engineering quality assurance framework
- **[NEW]** Memory block optimization algorithms
- **[NEW]** Context failure detection and prevention system
- **[NEW]** Intelligent eviction with recursive summarization

#### Phase 3: Memory Lifecycle + Sleep-Time Compute

- [ ] Enhanced automatic promotion/demotion system with memory types
- [ ] Memory decay implementation based on access and importance
- [ ] Consolidation processes for long-term and permanent memory
- [ ] Retention policies with context-aware prioritization
- [ ] Performance optimization with SQLite + Vector tuning
- **[NEW]** Sleep-time compute scheduler and optimization engine
- **[NEW]** Asynchronous memory consolidation during idle periods
- **[NEW]** Agent self-management through memory block editing
- **[NEW]** Context window budget optimization and management

#### Phase 4: Advanced Intelligence & Production Features

- [ ] Enhanced context-aware retrieval with memory block integration
- [ ] Advanced automatic summarization with recursive compression
- [ ] Relationship detection across semantic, episodic, and procedural memory
- [ ] Learning feedback loops with preference adaptation
- [ ] Recommendation system with context engineering insights
- **[NEW]** Production context engineering with failure prevention
- **[NEW]** Cross-session memory continuity and personality persistence
- **[NEW]** Multi-modal content type routing and specialized processing
- **[NEW]** Developer workflow integration (IDE, Git, code review)
- **[NEW]** Context quality monitoring and automated optimization

#### Phase 5: Scaling, Optimization & Production Readiness

- [ ] Advanced database optimization for SQLite + Vector hybrid
- [ ] Multi-tier caching strategies with memory type awareness
- [ ] Query optimization for complex relational + vector searches
- [ ] Memory usage tuning with automatic capacity management
- [ ] Performance monitoring with context engineering metrics
- **[NEW]** Production deployment with horizontal scaling
- **[NEW]** Monitoring dashboard for context quality and agent performance
- **[NEW]** Automated memory maintenance and optimization schedules
- **[NEW]** A/B testing framework for context engineering improvements
- **[NEW]** Developer tools for memory visualization and debugging

### File Structure

```text
packages/memory/src/
├── index.ts                    # Public exports
├── core/
│   ├── memory.ts              # MemoryEntry and interfaces
│   ├── manager.ts             # MemoryManager
│   ├── hierarchy.ts           # Memory tiers
│   └── lifecycle.ts           # Lifecycle management
├── storage/
│   ├── tiers/                 # Tier-specific storage
│   ├── index.ts               # Storage abstractions
│   └── migration.ts           # Data migration
├── semantic/
│   ├── embeddings.ts          # Vector embeddings
│   ├── search.ts              # Semantic search
│   ├── clustering.ts          # Content clustering
│   └── relationships.ts       # Relationship detection
├── compression/
│   ├── summarizer.ts          # Memory summarization
│   ├── compressor.ts          # Memory compression
│   ├── extractor.ts           # Key point extraction
│   └── consolidator.ts        # Memory consolidation
├── context/
│   ├── retriever.ts           # Context-aware retrieval
│   ├── analyzer.ts            # Context analysis
│   └── profiler.ts            # Retrieval profiling
├── learning/
│   ├── engine.ts              # Learning engine
│   ├── feedback.ts             # Feedback processing
│   ├── patterns.ts             # Pattern detection
│   └── adaptation.ts          # Adaptive behavior
├── relationships/
│   ├── graph.ts               # Memory graph
│   ├── analyzer.ts            # Relationship analysis
│   ├── traversal.ts           # Graph traversal
│   └── orphans.ts             # Orphan detection
└── utils/
    ├── scoring.ts             # Importance scoring
    ├── timing.ts              # Temporal analysis
    └── cleanup.ts             # Maintenance utilities
```

### Verification Criteria (Enhanced with Research Insights)

#### Core System Validation

- [ ] Multi-modal content storage works across all memory types
- [ ] Semantic search accuracy > 90% for semantic and episodic memory
- [ ] Memory lifecycle management prevents overflow with intelligent eviction
- [ ] Context-aware retrieval improves relevance through dynamic composition
- [ ] Learning system improves over time with interaction feedback
- [ ] Performance scales to 1M+ memories with tiered storage

#### Context Engineering Validation (NEW)

- [ ] Context completeness > 85% for complex tasks
- [ ] Context failure rate < 5% in edge cases
- [ ] Token efficiency improvement > 75% in real usage
- [ ] Context quality score > 80% for formatted outputs
- [ ] Dynamic context assembly works under 200ms latency

#### Memory Block System Validation (NEW)

- [ ] Memory block management prevents context overflow
- [ ] Agent self-management improves context quality over time
- [ ] Sleep-time agents successfully optimize memory during idle periods
- [ ] Memory block edit operations preserve semantic relationships
- [ ] Pinned content maintains relevance across sessions

#### Sleep-Time Compute Validation (NEW)

- [ ] Asynchronous memory optimization improves retrieval quality
- [ ] Sleep-time consolidation reduces memory footprint > 20%
- [ ] Pattern detection produces actionable insights
- [ ] Memory rewriting improves context organization
- [ ] Proactive optimization prevents context failures

#### Real-World Agent Integration Validation (NEW)

- [ ] Developers report "magical" agent responses through rich context
- [ ] Context engineering reduces prompt engineering requirement > 50%
- [ ] Cross-session memory maintains agent personality and knowledge
- [ ] Multi-modal content (code, docs, conversations) properly categorized
- [ ] IDE integration provides seamless development workflow memory

### Risk Register (Enhanced with Research-Based Risks)

#### Technical Implementation Risks

- **High**: Context engineering completeness - missing critical information leading to agent failures
- **High**: Memory block management complexity - context window overflow and performance degradation
- **Medium**: Sleep-time compute optimization - unintended memory corruption during background processing
- **Medium**: Semantic search accuracy and relevance across memory types
- **Medium**: Memory compression losing important information during summarization
- **Medium**: Scaling to large memory sets with SQLite + Vector hybrid approach

#### System Architecture Risks (NEW)

- **High**: Context failure cascade - poor context composition leading to multiple downstream failures
- **Medium**: Memory temperature tracking accuracy - hot/cold classification errors affecting retrieval
- **Medium**: Cross-session memory continuity - data loss or corruption during persistence
- **Low**: Multi-modal content complexity management
- **Low**: Learning algorithm instability during sleep-time processing

#### Integration & Adoption Risks (NEW)

- **Medium**: Developer adoption curve - context engineering complexity hindering usage
- **Low**: Performance overhead from comprehensive context gathering
- **Low**: Memory growth management - uncontrolled storage expansion
- **Low**: Agent compatibility across different foundation models

#### Mitigation Strategies (NEW)

- Context completeness validation through quality assurance frameworks
- Gradual rollout with A/B testing for context engineering improvements
- Comprehensive backup and recovery systems for memory corruption
- Performance monitoring and automatic optimization triggering
- Developer feedback loops for continuous improvement

### Success Metrics (Enhanced with Research-Based KPIs)

#### Core Memory System Metrics

- Semantic search precision/recall > 90%
- Memory compression ratio > 70%
- Context-aware retrieval relevance > 80%
- Learning convergence within 1000 interactions
- Performance < 100ms for typical queries
- Memory growth rate < 10% per day

#### Context Engineering Metrics (NEW)

- **Context completeness score** > 85% (critical information coverage)
- **Context failure rate** < 5% (missing crucial information)
- **Token efficiency improvement** > 75% (reduced context waste)
- **Context quality score** > 80% (format and organization)
- **Time-to-optimal-context** < 200ms (context assembly speed)

#### Memory Block Management Metrics (NEW)

- **Memory block hit rate** > 70% (relevant pre-structured content)
- **Block editing frequency** (agent self-optimization activity)
- **Context window utilization** > 80% (efficient space usage)
- **Smart eviction accuracy** > 90% (right content removed)

#### Sleep-Time Optimization Metrics (NEW)

- **Sleep-time processing efficiency** > 60% (idle time utilization)
- **Memory quality improvement** > 15% (post-sleep optimization)
- **Pattern detection accuracy** > 80% (useful learning patterns)
- **Preference learning convergence** < 500 sessions (personalization)

#### Agent Performance Metrics (NEW)

- **Task completion rate with context engineering** > 90%
- **Reduced LLM calls through better context** > 30%
- **Cross-session memory continuity** > 95%
- **Context reuse across similar tasks** > 70%

### Integration with Notable Libraries

#### Memelord Integration

- Hierarchical memory visualization
- Memory clustering algorithms
- Semantic relationship detection

#### OB1 Integration

- Advanced relationship graph traversal
- Context-aware retrieval algorithms
- Memory exploration patterns

#### Karpathy Concepts

- Attention-based memory ranking
- Forgetting curve implementation
- Retrieval-augmented generation patterns

#### CoG Integration

- Continuous learning feedback loops
- Adaptive chunking strategies
- Memory consolidation workflows

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Three-layer architecture alignment (updated with ecosystem findings)

Layering extracted and preserved from technical design:

1. **Raw event log (Layer 0)** — append-only JSONL with independent cursors.
2. **Wiki store (Layer 1)** — synthesized pages across `entities`, `concepts`, `synthesis`, `sources`.
3. **Vector index (Layer 2)** — semantic retrieval over synthesized pages.

### Lifecycle contracts (updated with ecosystem integration)

- `startTask(sessionId)` at loop entry.
- `endTask(sessionId)` at loop end with synthesis trigger.
- Context injection path remains XML-based via `buildContextXml(...)` for downstream prompt assembly.

### Security constraints carried forward

- Retrieved memory is treated as untrusted content.
- Sanitization before prompt injection remains required.
- Scope isolation (`project`, `user`, `team`, `global`) remains explicit in storage and retrieval paths.

### NEW Ecosystem Integration Additions (from 2026-05-14 ecosystem analysis)

#### A. Honker Coordination Layer (NEW - HIGH PRIORITY)

**Purpose:** Local-low-latency coordination with remote Turso sync support

```typescript
// Honker extension integration for coordination
interface HonkerCoordination {
  // Extension loading
  loadExtension_in_sqlite: () => Promise<void>;

  // Pub/sub for coordination
  pubSub: {
    notify: (channel: string, data: any) => Promise<void>;
    listen: (channel: string, callback: (data: any) => void) => void;
    channels: ['agent-lifecycle', 'memory-updates', 'coordination-events']
  };

  // Task queue for orchestration
  queue: {
    enqueue: (task: any, tx?: any) => Promise<void>;
    dequeue: (workerId: string, options?: DequeueOptions) => Promise<Task | null>;
    heartbeat: (taskId: string) => Promise<void>;
    retry: { exponential: true, maxAttempts: 5, backoffMs: 1000 }
  };

  // Atomic pattern
  atomicWorkflow: async (tx: any) => {
    await tx.queue.enqueue({ payload: 'task-data' });
    await tx.memory.insert({ data: 'memory-data' });
    // Rollback together if either fails
  };

  // Time-triggered scheduling
  scheduling: {
    schedule: (cron: string, taskId: string) => Promise<void>;
    schedule_periodic: (seconds: number, action: () => Promise<void>) => Promise<void>;
    jobCancellation: (taskId: string) => Promise<void>;
  };

  // Local SQLite + Turso sync
  tursoSync: {
    sync: () => Promise<void>;
    replication: 'Turso for cloud sync and backup',
    conflictResolution: 'Time-triggered merge strategies'
  };
}
```

#### B. AgentFS Integration (NEW - PRIMARY FILESYSTEM)

**Purpose:** Agent-specific filesystem with audit trails and Turso-native design

```typescript
// AgentFS SDK integration for agent operations
interface AgentFSIntegration {
  // Core filesystem operations
  filesystem: {
    readFile: (path: string) => Promise<Buffer>;
    writeFile: (path: string, content: Buffer) => Promise<void>;
    listDirectory: (path: string) => Promise<string[]>;
    createDirectory: (path: string) => Promise<void>;
    removeFile: (path: (path: string) => Promise<void>;
    removeDirectory: (path: string) => Promise<void>;
  };

  // Key-value store for state
  keyvalue: {
    set: (key: string, value: any) => Promise<void>;
    get: (key: string) => Promise<any>;
    delete: (key: string) => Promise<void>;
  };

  // Tool call audit trails
  toolcall: {
    record: (tool: string, startTime: number, endTime: number, input: any, output: any, error?: string) => Promise<void>;
    get: (limit: number, offset: number) => Promise<ToolCallRecord[]>;
    query: (filter?: ToolCallFilter) => Promise<ToolCallRecord[]>;
  };

  // Snapshot capabilities
  snapshot: {
    create: () => Promise<string>;    // Returns snapshot ID
    restore: (snapshotId: string) => Promise<void>;  // Restore to exact state
    timeTravel: (pointInTime: string) => Promise<void>;  // Time travel to exact state
  };

  // Integration points
  integration: {
    sdk: 'TypeScript SDK for TS clients',
    python: 'Python SDK for runtime integration',
    rust: 'Rust SDK for performance',
   \Facades: 'FsClient, FsClient, FsClient',
    mounting: 'FUSE (Linux), NFS (macOS)'
  };

  // Toole support
  cli: 'agentfs fs <agent-id> ls',
  mount: 'Local filesystem mounting at /mnt',
  sandboxRun: 'Run code with sandbox environment'
};
```

#### C. RAG Enhancement with mcp-rag-server (PRIMARY)

**Purpose:** Zero-ceremony RAG with local LLM support, MCP-native design

```typescript
// mcp-rag-server integration for retrieval
interface MCRAGServerIntegration {
  // Auto-ingest on startup
  autoIngest: {
    dataDirectory: '/data/documents',
    supportedFormats: ['markdown', 'text', 'pdf', 'docx'],
    localEmbeddings: 'Nomic v1.5 cached locally'
  };

  // Dual-tool pattern
  localFirst: {
    storage: 'local filesystem',
    indexing: 'local vector database',
    llmSupport: 'ollama + continue.dev'
  };

 -tools: 'knowledgeBaseSearch | Web Search | IngestDocument';

  // MCP integration
  mcpServer: {
    protocol: 'Model Context Protocol',
    tools: 'Three MCP tools for agent integration'
  };
}
```

#### D. Content Addressing (re_gent pattern)

**Purpose:** Automatic deduplication + sub-10ms lookups

```typescript
// BLAKE3 content addressing integration
interface ContentAddressing {
  // BLAKE3 hashing for content
  hash: (content: Buffer) => BLAKE3Hash;

  // Automatic deduplication
  deduplicate: (hash: BLAKE3Hash) => Promise<MemoryEntry | null>;

  // Fast lookups
  query: (hash: BLAKE3Hash) => Promise<MemoryEntry | undefined>;

  // SQLite index for sub-10ms lookups
  index: {
    create: () => Promise<SQLiteIndex>;
    query: (hash: BLAKE3Hash) => Promise<MemoryEntry[]>;
  };
}
```

#### E. Learning Systems Adaptation (Marmot patterns)

**Purpose:** Adaptive behavior from interactions

```typescript
// Learning interface extensions
interface LearningEnhancements {
  // Interaction-based learning
  learnFromInteraction: (interaction: Interaction) => Promise<void>;
  updateEmbeddings: (memoryIds: string[]) => Promise<void>;

  // Quality feedback
  improveWithFeedback: (feedback: RetrievalFeedback) => Promise<void>;
  detectPatterns: () => Promise<MemoryPattern[]>;

  // Context circulation
  learnFromContextFailures: (failures: ContextFailure[]) => Promise<void>;
  optimizeContextBuilding: (usage: ContextUsage[]) => Promise<OptimizationResult>;
  learnContentPreference: (feedback: ContentFeedback) => Promise<PreferenceProfile>;

  // Sleep-time compute
  scheduleSleepProcessing: (schedule: SleepSchedule) => Promise<void>;
  optimizeDuringSleep: (criteria: SleepOptimizationCriteria) => Promise<SleepResult>;
  consolidateDuringSleep: (timeBudget: number) => Promise<ConsolidationResult>;
}
```

### Lifecycle contracts (updated with integration)

- `startTask(sessionId)` at loop entry.
- `endTask(sessionId)` at loop end with synthesis trigger.
- Context injection path remains XML-based via `buildContextXml(...)` for downstream prompt assembly.

### Security constraints carried forward

- Retrieved memory is treated as untrusted content.
- Sanitization before prompt injection remains required.
- Scope isolation (`project`, `user`, `team`, `global`) remains explicit in storage and retrieval paths.
