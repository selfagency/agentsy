# Phase 14 — External Pattern Adoptions

**Authority:** `plan/17-GOVERNANCE-QUALITY-GATES.md`
**Created:** 2026-05-28
**Status:** Planned

---

## Goal

Adopt proven patterns from 7 external repositories into existing @agentsy packages. All adoptions are **pattern-level** — no code copying, no license contamination.

---

## Adoption 1: cognee — Memory API Redesign

**Source:** topoteretes/cognee (17.6k stars)
**Target packages:** `@agentsy/memory`, `@agentsy/session`

### TASK-EXT-001: Four-operation memory API

**Effort:** 2h
**Location:** `packages/memory/src/index.ts`

Replace current scattered memory operations with cognee's clean 4-op surface:

```typescript
// Remember — store permanently in knowledge graph
export async function remember(content: string, options?: { dataset?: string }): Promise<MemoryEntry>;

// Remember session — fast cache, syncs to graph in background
export async function rememberSession(content: string, sessionId: string): Promise<SessionEntry>;

// Recall — query with auto-routing (picks best search strategy)
export async function recall(query: string, options?: { sessionId?: string }): Promise<MemoryResult[]>;

// Forget — delete when done
export async function forget(dataset?: string): Promise<void>;

// Improve — learn from feedback (cognee's unique addition)
export async function improve(entryId: string, feedback: Feedback): Promise<void>;
```

### TASK-EXT-002: Session memory with background sync

**Effort:** 2h
**Location:** `packages/session/src/session-memory.ts`

```typescript
export class SessionMemory {
  private fastCache = new Map<string, SessionEntry>();
  private syncQueue: SessionEntry[] = [];

  async store(content: string, sessionId: string): Promise<void> {
    const entry = { content, sessionId, timestamp: Date.now() };
    this.fastCache.set(`${sessionId}:${entry.timestamp}`, entry);
    this.syncQueue.push(entry);
    this.flushToGraph(); // Background sync to permanent knowledge graph
  }

  async recall(query: string, sessionId: string): Promise<MemoryResult[]> {
    // Check session memory first, fall through to graph if needed
    const sessionResults = this.searchFastCache(query, sessionId);
    if (sessionResults.length > 0) return sessionResults;
    return this.searchGraph(query);
  }
}
```

### TASK-EXT-003: Auto-routing for recall

**Effort:** 1.5h
**Location:** `packages/memory/src/recall-router.ts`

```typescript
export class RecallRouter {
  route(query: string): SearchStrategy {
    if (isFactualQuery(query)) return 'vector';
    if (isRelationalQuery(query)) return 'graph';
    if (isSessionQuery(query)) return 'session';
    return 'hybrid'; // Default: vector + graph + rerank
  }
}
```

---

## Adoption 2: agentica — Function Calling Enhancements

**Source:** wrtnlabs/agentica (1k stars)
**Target packages:** `@agentsy/tools`, `@agentsy/orchestrator`

### TASK-EXT-004: Selector Agent (function filtering)

**Effort:** 2h
**Location:** `packages/tools/src/selector-agent.ts`

Filter candidate functions to minimize context usage and optimize performance:

```typescript
export class SelectorAgent {
  async selectCandidateFunctions(
    userQuery: string,
    allTools: ToolDefinition[],
    maxCandidates: number = 10
  ): Promise<ToolDefinition[]> {
    // Use LLM to score relevance of each tool
    const scores = await this.scoreTools(userQuery, allTools);
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates)
      .map(s => s.tool);
  }
}
```

### TASK-EXT-005: Validation Feedback (AI arg correction)

**Effort:** 1.5h
**Location:** `packages/tools/src/validation-feedback.ts`

Detect and correct AI mistakes in argument composition:

```typescript
export class ValidationFeedback {
  async validateAndCorrect(
    toolCall: ToolCall,
    schema: ZodSchema
  ): Promise<{ corrected: boolean; args: unknown; errors?: string[] }> {
    const result = schema.safeParse(toolCall.args);
    if (result.success) return { corrected: false, args: result.data };

    // Ask LLM to correct the errors
    const corrected = await this.requestCorrection(toolCall, result.error);
    return { corrected: true, args: corrected.args, errors: result.error.errors };
  }
}
```

---

## Adoption 3: eko — Workflow Controls

**Source:** FellouAI/eko (4.9k stars)
**Target packages:** `@agentsy/orchestrator`, `@agentsy/workflows`

### TASK-EXT-006: Pause/Resume/Interrupt with task_snapshot recovery

**Effort:** 2h
**Location:** `packages/orchestrator/src/workflow-controls.ts`

```typescript
export interface TaskSnapshot {
  workflowId: string;
  stateId: string;
  context: Record<string, unknown>;
  toolCallHistory: ToolCall[];
  capturedValues: Record<string, unknown>;
  timestamp: number;
}

export class WorkflowControls {
  async pause(snapshot: TaskSnapshot): Promise<void>;
  async resume(snapshotId: string): Promise<void>;
  async interrupt(reason: string): Promise<void>;
  async recover(snapshotId: string): Promise<TaskSnapshot>;
}
```

### TASK-EXT-007: Dependency-aware parallel agent execution

**Effort:** 2h
**Location:** `packages/orchestrator/src/parallel-executor.ts`

```typescript
export interface DependencyGraph {
  nodes: { id: string; dependencies: string[] }[];
}

export class ParallelExecutor {
  async executeWithDependencies(
    graph: DependencyGraph,
    executeNode: (id: string) => Promise<unknown>
  ): Promise<Record<string, unknown>> {
    // Topological sort + parallel execution where dependencies allow
    const levels = this.topologicalLevels(graph);
    const results: Record<string, unknown> = {};

    for (const level of levels) {
      const levelResults = await Promise.all(
        level.map(id => executeNode(id).then(r => ({ id, result: r })))
      );
      for (const { id, result } of levelResults) {
        results[id] = result;
      }
    }
    return results;
  }
}
```

---

## Adoption 4: deer-flow — Super Agent Patterns

**Source:** bytedance/deer-flow (69.9k stars)
**Target packages:** `@agentsy/plugins`, `@agentsy/orchestrator`, `@agentsy/connectors`

### TASK-EXT-008: Progressive skill loading

**Effort:** 2h
**Location:** `packages/plugins/src/skill-loader.ts`

Only load skills when the task needs them, not all at once:

```typescript
export class ProgressiveSkillLoader {
  async loadRelevantSkills(
    userQuery: string,
    skillRegistry: SkillRegistry
  ): Promise<Skill[]> {
    // Score skills by relevance to query
    const scores = await this.scoreSkills(userQuery, skillRegistry);
    // Load only skills above relevance threshold
    return scores
      .filter(s => s.score > this.threshold)
      .map(s => skillRegistry.load(s.skillId));
  }
}
```

### TASK-EXT-009: Isolated sub-agent context

**Effort:** 1.5h
**Location:** `packages/orchestrator/src/subagent-context.ts`

```typescript
export class SubAgentContext {
  private parentContext: AgentContext;
  private scopedTools: ToolDefinition[];
  private scopedMemory: MemoryStore;

  constructor(parent: AgentContext, scope: SubAgentScope) {
    this.parentContext = parent;
    this.scopedTools = scope.tools ?? parent.tools;
    this.scopedMemory = new MemoryStore(); // Isolated memory
  }

  async reportBack(result: SubAgentResult): Promise<void> {
    // Synthesize result into parent context
    this.parentContext.mergeResult(result);
  }
}
```

### TASK-EXT-010: IM channel integration

**Effort:** 3h
**Location:** `packages/connectors/src/channels/`

Add IM channel support following deer-flow's pattern:

```text
packages/connectors/src/channels/
├── telegram.ts      # Bot API (long-polling)
├── slack.ts         # Socket Mode
├── discord.ts       # Already exists, extend
└── types.ts         # Channel interface
```

### TASK-EXT-011: Context summarization for long tasks

**Effort:** 1.5h
**Location:** `packages/orchestrator/src/context-summarizer.ts`

```typescript
export class ContextSummarizer {
  async summarizeCompletedSubTask(taskResult: TaskResult): Promise<string>;
  async compressIrrelevantContext(context: AgentContext): Promise<AgentContext>;
  async offloadToFile(intermediateResults: unknown[]): Promise<string>;
}
```

---

## Adoption 5: agno — Platform Patterns

**Source:** agno-agi/agno (40.4k stars)
**Target packages:** `@agentsy/guardrails`, `@agentsy/runtime`, `@agentsy/mcp`

### TASK-EXT-012: Human approval with admin-block tools

**Effort:** 1.5h
**Location:** `packages/guardrails/src/human-approval.ts`

```typescript
export interface ApprovalConfig {
  pauseForConfirmation: boolean;
  blockedTools: string[]; // Tools requiring admin approval
  adminApprovalRequired: boolean;
}

export class HumanApproval {
  async requestApproval(toolCall: ToolCall, config: ApprovalConfig): Promise<ApprovalResult>;
  async blockTool(toolName: string): Promise<void>;
  async unblockTool(toolName: string): Promise<void>;
}
```

### TASK-EXT-013: Context providers

**Effort:** 2h
**Location:** `packages/mcp/src/context-providers.ts`

Live data from Slack, Drive, wikis, MCP:

```typescript
export interface ContextProvider {
  name: string;
  fetch(query: string): Promise<ContextResult[]>;
}

export class ContextProviderRegistry {
  register(provider: ContextProvider): void;
  async fetchFromAll(query: string): Promise<ContextResult[]>;
}
```

### TASK-EXT-014: AG-UI + A2A interface exposure

**Effort:** 2h
**Location:** `packages/runtime/src/interfaces/`

Expose agents via AG-UI and A2A protocols:

```text
packages/runtime/src/interfaces/
├── agui.ts          # Already exists, extend
├── a2a.ts           # New: A2A protocol implementation
└── types.ts         # Interface types
```

---

## Adoption 6: octotools — Tool Card Pattern

**Source:** octotools/octotools (1.5k stars)
**Target packages:** `@agentsy/tools`

### TASK-EXT-015: Tool card standardization

**Effort:** 1h
**Location:** `packages/tools/src/tool-card.ts`

Standardize tool definitions following octotools' tool card pattern:

```typescript
export interface ToolCard {
  name: string;
  description: string;
  metadata: {
    domain: string;
    inputTypes: string[];
    outputTypes: string[];
  };
  execute: (input: unknown) => Promise<unknown>;
  validate: (input: unknown) => boolean;
}
```

---

## Adoption 7: context-mode — Session Continuity

**Source:** mksglu/context-mode (15.9k stars)
**Target packages:** `@agentsy/session`

### TASK-EXT-016: SQLite session event log

**Effort:** 3h
**Location:** `packages/session/src/event-log.ts`

Track all tool calls, edits, decisions, and errors in a local SQLite database for post-compaction recovery:

```typescript
export interface SessionEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'tool_call' | 'edit' | 'decision' | 'error' | 'task_start' | 'task_end';
  payload: Record<string, unknown>;
  context?: string; // Brief description for search indexing
}

export class SessionEventLog {
  private db: Database;

  async record(event: Omit<SessionEvent, 'id' | 'timestamp'>): Promise<SessionEvent>;
  async getEvents(sessionId: string, since?: number): Promise<SessionEvent[]>;
  async getRecentEvents(limit?: number): Promise<SessionEvent[]>;
}
```

### TASK-EXT-017: FTS5 search across sessions

**Effort:** 2h
**Location:** `packages/session/src/session-search.ts`

Full-text search over session events to answer "What was I working on?" after context compacts:

```typescript
export interface SessionSearchResult {
  event: SessionEvent;
  relevanceScore: number;
  snippet?: string;
}

export class SessionSearch {
  async search(query: string, options?: {
    sessionId?: string;
    limit?: number;
    since?: number;
  }): Promise<SessionSearchResult[]>;

  async getActiveSessions(): Promise<string[]>;
  async getSessionSummary(sessionId: string): Promise<string>;
}
```

### TASK-EXT-018: PreCompact hook for resume snapshot

**Effort:** 1.5h
**Location:** `packages/session/src/compact-hooks.ts`

Build a resume snapshot before conversation context compacts, preserving working state:

```typescript
export interface ResumeSnapshot {
  sessionId: string;
  timestamp: number;
  activeFiles: string[];
  pendingTasks: string[];
  lastDecision: string;
  keyFindings: string[];
}

export class CompactHooks {
  onPreCompact(handler: () => Promise<ResumeSnapshot>): void;
  async getLatestSnapshot(sessionId: string): Promise<ResumeSnapshot | null>;
}
```

---

## Timeline

| Task | Effort | Dependencies |
|------|--------|-------------|
| EXT-001: Four-op memory API | 2h | None |
| EXT-002: Session memory + sync | 2h | EXT-001 |
| EXT-003: Auto-routing for recall | 1.5h | EXT-001 |
| EXT-004: Selector Agent | 2h | None |
| EXT-005: Validation Feedback | 1.5h | EXT-004 |
| EXT-006: Pause/Resume/Interrupt | 2h | None |
| EXT-007: Dependency-aware parallel | 2h | EXT-006 |
| EXT-008: Progressive skill loading | 2h | None |
| EXT-009: Isolated sub-agent context | 1.5h | EXT-008 |
| EXT-010: IM channel integration | 3h | None |
| EXT-011: Context summarization | 1.5h | EXT-009 |
| EXT-012: Human approval | 1.5h | None |
| EXT-013: Context providers | 2h | None |
| EXT-014: AG-UI + A2A exposure | 2h | None |
| EXT-015: Tool card standardization | 1h | None |
| EXT-016: SQLite session event log | 3h | None |
| EXT-017: FTS5 search across sessions | 2h | EXT-016 |
| EXT-018: PreCompact hook | 1.5h | EXT-016 |
| **Total** | **~33.5 hours** | |

---

## Success Criteria

- [ ] Memory API exposes `remember`/`recall`/`forget`/`improve` operations
- [ ] Session memory with background sync to knowledge graph
- [ ] Recall auto-routes to best search strategy
- [ ] Selector Agent filters candidate functions to minimize context
- [ ] Validation Feedback detects and corrects AI arg mistakes
- [ ] Workflow pause/resume/interrupt with task_snapshot recovery
- [ ] Dependency-aware parallel agent execution
- [ ] Progressive skill loading (only when needed)
- [ ] Isolated sub-agent context
- [ ] IM channel integration (Telegram, Slack, Discord)
- [ ] Context summarization for long tasks
- [ ] Human approval with admin-block tools
- [ ] Context providers for live data
- [ ] AG-UI + A2A interface exposure
- [ ] Tool card standardization
- [ ] SQLite session event log tracks tool calls, edits, decisions, errors
- [ ] FTS5 search answers "What was I working on?" after context compaction
- [ ] PreCompact hook builds resume snapshot before conversation compacts
- [ ] All tests pass
- [ ] `pnpm check-types` clean
- [ ] `pnpm lint` clean

---

**Next:** Begin TASK-EXT-001 (four-operation memory API) or TASK-EXT-016 (SQLite session event log) for immediate session continuity gains.
