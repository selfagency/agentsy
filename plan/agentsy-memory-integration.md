# Plan: Agentsy Memory and Token Economy Integration

## 1. Background Analysis

### Reviewed Resources Summary

- **Agentsy memory plans**
  Establish the durable-memory architecture: raw event log, synthesized wiki, vector retrieval, scope boundaries, and white-box editing.

- **Agentsy token economy plan**
  Defines the ephemeral compression layer: budgets, context trimming, output shaping, semantic tool selection, and caching.

- **Agentsy subagents and recovery plans**
  Show that long-running agentic flows need shared context, resumability, and clear handoff points between workers.

### Key Takeaways

- Memory and token economy solve adjacent but different problems.
- Memory is the source of truth for durable knowledge.
- Token economy is the policy layer that decides what to send, what to summarize, and what to shorten.
- Recovery should be able to rebuild state from raw logs plus memory summaries.
- Subagents should share scoped memory without inheriting the entire conversation history.
- The integration must preserve white-box controls, scope isolation, and injection safety.

---

## 2. Requirements for Integration

We need a formal integration surface that provides:

- **Durable memory primitives**: raw logs, wiki pages, retrieval, scopes, and lifecycle hooks.
- **Token economy primitives**: budgets, reducers, output presets, cache policy, and metrics.
- **Shared artifact model**: summaries, retrieval payloads, and compression metadata.
- **Scoped retrieval**: memory should be queryable by task, session, project, team, and global boundaries.
- **Recovery linkage**: compressed summaries and event tails should support resumption.
- **Subagent linkage**: worker agents should share scoped memory instead of full raw chat history.
- **UI linkage**: memory entries and compression status should be inspectable.
- **Security linkage**: retrieved memory must be filtered, scrubbed, and quarantine-aware.

---

## 3. Proposed Architecture

### 3.1 Package Boundaries

#### `@agentsy/memory`

The durable knowledge layer.

- owns raw log persistence
- owns wiki synthesis and lifecycle
- owns retrieval and scope enforcement
- owns white-box editing and linting
- exposes pluggable provider interfaces so other stacks can swap in their own memory backend
- exposes a standalone MCP server / plugin surface for non-Agentsy consumers

#### `@agentsy/token-economy`

The transient compression policy layer.

- owns prompt budgets
- owns context reduction
- owns output shaping
- owns semantic tool selection
- owns cache policy and metrics
- can consume memory via an abstract provider interface rather than a concrete implementation

#### `@agentsy/recovery`

The checkpoint and resume layer.

- owns session restoration
- owns continuation prompts
- owns checkpoint replay
- uses memory summaries and raw log tails as inputs

#### `@agentsy/subagents`

The delegation layer.

- owns worker orchestration
- shares scoped memory artifacts with workers
- promotes durable findings back into memory
- must remain compatible with external or substitute memory systems

### 3.2 Shared Concepts

Introduce shared types that can be consumed by both memory and token economy:

- `MemoryScope`
- `MemorySummary`
- `MemoryArtifact`
- `CompressionPlan`
- `ContextSnapshot`
- `RetrievalCandidate`
- `RetentionPolicy`
- `InjectionPayload`
- `CompressionMetrics`

### 3.3 Integration Flow

A typical integrated flow should look like this:

1. **Before the turn**
   - token economy computes the budget
   - token economy asks memory for scoped summaries or retrievals
   - token economy selects only relevant tools and context

2. **During the turn**
   - memory receives observations, facts, and contradictions
   - token economy may trim or summarize long transient turns
   - subagents may read scoped memory and write back distilled outputs

3. **After the turn**
   - memory persists durable knowledge updates
   - token economy records compression and cache metrics
   - recovery stores the checkpoint state required for resumption

### 3.4 Trust and Safety Model

- Memory retrieval must be scoped and filtered before injection.
- Token economy must never compress structured data in a way that changes meaning.
- Subagents must not bypass memory trust boundaries.
- Recovery must not restore hidden or quarantined context by default.
- White-box edits should remain available for user correction and auditing.

---

## 4. Recommended API Surface

### Memory-facing APIs

- `createMemoryStore(...)`
- `createMemoryLifecycle(...)`
- `createMemoryRetriever(...)`
- `memory_search(...)`
- `memory_capture(...)`
- `memory_lint(...)`

### Token-economy-facing APIs

- `createTokenEconomy(...)`
- `createTokenBudgetPolicy(...)`
- `createContextReducer(...)`
- `createOutputReducer(...)`
- `planCompression(...)`

### Integration APIs

- `buildMemoryAwarePrompt(...)`
- `buildScopedContextSnapshot(...)`
- `applyCompressionPlan(...)`
- `persistSummaryCheckpoint(...)`
- `restoreFromSummaryCheckpoint(...)`

---

## 5. Implementation Plan

### Phase 1: Shared types and contracts

1. Define shared memory and compression types.
2. Add serialization rules for summaries and retrieval payloads.
3. Add validation for scoped context snapshots.

### Phase 2: Memory-to-token-economy bridge

1. Implement APIs for requesting scoped summaries and retrievals.
2. Let token economy decide when to fetch memory and how much to fetch.
3. Add tests for prompt size reduction without loss of grounded facts.

### Phase 3: Memory-backed compression

1. Store durable summaries in memory artifacts instead of ephemeral caches only.
2. Reuse memory summaries across turns when freshness and scope permit.
3. Add tests for summary reuse and stale-summary invalidation.

### Phase 4: Recovery and subagent integration

1. Restore sessions from checkpoint + summary + raw tail.
2. Allow subagents to consume scoped memory and publish durable findings.
3. Add tests for crash recovery and worker handoff behavior.

### Phase 5: Observability and quality gates

1. Track token savings, compression ratio, retrieval hit rate, and freshness.
2. Track contradiction rate and stale-memory rate.
3. Add integration tests that compare task success with and without compression.

---

## 6. Design Rules

- Memory owns truth; token economy owns policy.
- Compression should never be the only copy of durable facts.
- Summaries should carry provenance where possible.
- Scoped memory should be the default, not global memory.
- Retrieval should prefer grounded facts over verbose transcripts.
- Output shortening should be opt-in on human-facing paths.
- Recovery should use the smallest faithful state needed to continue.

---

## 7. Risk Mitigation & Best Practices

- Do not duplicate long-term knowledge in both token economy caches and memory stores.
- Do not treat summaries as immutable truth without freshness checks.
- Do not bypass scope boundaries for convenience.
- Do not compress machine-readable output blindly.
- Do not allow subagents to leak cross-scope memory without explicit permission.
- Do not rely on one compression method for all use cases.

---

## 8. Summary

This integration plan defines how `@agentsy/memory` and `@agentsy/token-economy` should cooperate.

The core principle is simple:

- `@agentsy/memory` stores durable knowledge and supports retrieval.
- `@agentsy/token-economy` budgets and reduces transient context.
- `@agentsy/recovery` restores state from summaries and raw tails.
- `@agentsy/subagents` shares scoped memory with workers.

Together, these modules give Agentsy a coherent memory model without duplicating responsibilities or blurring boundaries.
