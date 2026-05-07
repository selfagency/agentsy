# Plan: Agentsy Memory System

## 1. Background Analysis

### Reviewed Resources Summary

- **Agentsy PRD and platform plans**
  Define a 3-layer blended memory architecture: raw event log, synthesized wiki, and vector retrieval.

- **Deep-dive memory research**
  Emphasizes memory as a durable knowledge substrate, not a hidden orchestration layer.

- **Testing and safety plans**
  Highlight the need for prompt-injection detection, scope isolation, white-box editing, and deterministic replay.

### Key Takeaways

- Memory should be **durable, inspectable, and editable**.
- Memory must support **scope boundaries**: session, user, project, team, global.
- The system should preserve a **raw event log** while synthesizing higher-level knowledge.
- Retrieval should inject only grounded, filtered context back into the agent loop.
- Memory and compression are related, but memory is the source of truth while token reduction is the policy layer that decides what to fetch or summarize.
- White-box controls are essential for trust and debugging.

---

## 2. Requirements for Agentsy Memory Support

Based on the current Agentsy plans, we need:

- **Layer 0 raw event log**: append-only session history with replay support.
- **Layer 1 synthesized wiki**: durable knowledge pages compiled from sessions.
- **Layer 2 semantic retrieval**: vector search and ranking over the wiki.
- **Scope model**: session, user, project, team, and global visibility boundaries.
- **Lifecycle hooks**: startTask, report, endTask, contradict, lint, capture.
- **White-box editing**: read, create, update, and delete memory entries at runtime.
- **Safety model**: prompt-injection detection, privacy tags, trust tiers, and scope guards.
- **Injection pipeline**: inject retrieved memory through structured context blocks, not raw untrusted text.
- **Observability**: freshness, confidence, coverage, contradictions, orphan pages, and stale pages.

---

## 3. Proposed Architecture

### 3.1 New Package: `@agentsy/memory`

Create the durable-memory package as the canonical memory subsystem:

- **Core abstractions**:
  - `MemoryStore`
  - `RawEventLog`
  - `WikiStore`
  - `MemoryLifecycle`
  - `MemoryRetriever`
  - `MemoryScope`
  - `MemoryFeedback`
  - `MemoryLinter`
  - `MemoryArtifact`
  - `MemorySummary`

- **Primary responsibilities**:
  - persist raw session events
  - synthesize durable knowledge pages
  - expose semantic retrieval over compiled memory
  - enforce scope and trust boundaries
  - support white-box editing
  - detect contradictions and stale content
  - provide clean retrieval payloads for context injection

### 3.2 Memory Layers

#### Layer 0: Raw Event Log

- append-only JSONL session history
- deterministic replay support
- cursor-based reads for incremental compaction
- separated from synthesized knowledge

#### Layer 1: Synthesized Wiki

- maintained knowledge pages
- distilled facts and relationships
- citations and provenance metadata
- linting for contradictions, orphan pages, and stale pages

#### Layer 2: Semantic Retrieval

- vector-backed or hybrid retrieval over wiki content
- top-K lookup by query
- score-aware ranking
- retrieval results formatted for safe context injection

### 3.3 Lifecycle Model

The memory lifecycle should follow a consistent loop:

1. **startTask**
   - load relevant memory context
   - retrieve scoped pages
   - inject grounded facts into the agent loop

2. **report**
   - append observations during work
   - record useful facts, findings, and contradictions

3. **endTask**
   - synthesize durable knowledge updates
   - refresh wiki pages
   - update indexes and retrieval embeddings

4. **contradict**
   - replace stale or incorrect pages with corrected ones
   - preserve history for traceability

5. **lint**
   - scan for stale, orphaned, contradictory, or low-confidence entries

### 3.4 Scope and Trust Model

- Scope tiers must be first-class and explicit.
- Cross-scope access should require a trust decision.
- Team and project memory should not leak into global queries by default.
- Retrieved memory carrying instruction-override language must be quarantined or dropped.

### 3.5 Injection Model

- Retrieval results should be injected via structured context tags.
- The injection path must pass through existing context scrubbing and deduplication utilities.
- Privacy tags must be honored before the model sees the content.

### 3.6 Modular Deployment Modes

- `@agentsy/memory` must be **pluggable**: consumers can substitute their own memory backend or memory system without adopting the rest of Agentsy.
- Expose a `MemoryProvider` / `MemoryBackend` abstraction so external stacks can adapt their own storage, retrieval, and lifecycle primitives.
- Provide a standalone **MCP server** entrypoint so the memory module can be consumed from any MCP-capable client or agent runtime.
- Provide a standalone **plugin** surface so editor integrations, CLI tools, and other frameworks can embed memory without pulling in Agentsy orchestration.
- Keep the Agentsy-native memory implementation as one provider, not the only valid implementation.

### 3.7 Cog-Style Retention Tiers

- **Hot memory**: the current task/session working set, optimized for immediate use and fast pruning.
- **Warm memory**: synthesized wiki pages, scoped summaries, and stable working context used across nearby turns.
- **Cold memory**: archived raw logs, historical wiki snapshots, and older retrieval indexes kept for audit, replay, and deep recall.
- Retention tiers are an implementation model, not a required public API; external memory backends may map these concepts differently.

### 3.8 Maintenance and Scheduling

- Memory maintenance should be expressed as explicit jobs: compaction, synthesis, linting, pruning, and retrieval index refresh.
- Those jobs may be triggered by `@agentsy/scheduler` or by any equivalent external scheduler; `@agentsy/memory` must not own the cron engine.
- Scheduler-driven maintenance should move facts from hot → warm → cold according to freshness, confidence, and scope.
- Token economy may request fresh summaries or trigger compaction when prompt budgets are under pressure.
- Subagents and recovery may read from warm summaries while the raw event log remains the cold source of truth.

---

## 4. Proposed Package Shape

### `@agentsy/memory`

This package should be the main public entry point for durable memory.

#### Responsibilities

- raw log persistence
- wiki synthesis and maintenance
- retrieval and ranking
- scope control
- linting and diagnostics
- white-box editing operations

#### Suggested API surface

- `createMemoryStore(...)`
- `createRawEventLog(...)`
- `createWikiStore(...)`
- `createMemoryLifecycle(...)`
- `createMemoryRetriever(...)`
- `createMemoryLinter(...)`
- `createMemoryProvider(...)`
- `createMemoryBackend(...)`
- `createMemoryMCPServer(...)`
- `createMemoryPlugin(...)`
- `createMemoryMaintenanceJobs(...)`
- `memory_search(...)`
- `memory_capture(...)`
- `memory_list(...)`
- `memory_stats(...)`
- `memory_lint(...)`
- `memory_compact(...)`
- `memory_synthesize(...)`
- `memory_refresh_index(...)`

### Internal helper modules

- `raw-log.ts` for session event storage
- `wiki.ts` for durable knowledge pages
- `lifecycle.ts` for memory task flow
- `retrieval.ts` for semantic lookup
- `scope.ts` for trust and visibility boundaries
- `lint.ts` for contradiction and freshness checks
- `injection.ts` for safe context injection

---

## 5. Integration With Existing Agentsy Packages

This module should fit into the current framework without collapsing into orchestration:

- `@agentsy/processor`
  - call memory hooks around agent turn boundaries
- `@agentsy/context`
  - inject retrieved memory as structured context and dedupe repeated blocks
- `@agentsy/structured`
  - validate memory payloads and normalized retrieval artifacts
- `@agentsy/token-economy`
  - decide when to retrieve, summarize, or compress before prompt assembly
- `@agentsy/recovery`
  - restore from raw log + memory summary checkpoints
- `@agentsy/subagents`
  - share scoped memory across worker tasks and promote high-confidence results
- `@agentsy/ui` and `@agentsy/ag-ui`
  - surface memory entries, scopes, freshness, editability, and maintenance status in the UI
- `@agentsy/scheduler`
  - run recurring memory maintenance jobs, including compaction, synthesis, linting, and retrieval index refresh

## 6. Implementation Plan

### Phase 1: Core storage and types

1. Define memory types, scopes, artifacts, and lifecycle interfaces.
2. Implement raw event log persistence.
3. Implement wiki page storage and indexing.
4. Add tests for append/read, page CRUD, and cursor behavior.

### Phase 2: Lifecycle and synthesis

1. Implement startTask, report, endTask, contradict, and lint.
2. Add wiki synthesis and update flows.
3. Add contradiction resolution and stale-page detection.
4. Add tests for the full lifecycle.

### Phase 3: Retrieval and injection

1. Implement retrieval ranking and top-K lookup.
2. Add scoped retrieval filters.
3. Inject retrievals through structured context tags.
4. Add tests for injection safety and injection-detection behavior.

### Phase 4: White-box editing and UI surfaces

1. Implement read/create/update/delete memory operations.
2. Expose editability to UI and CLI surfaces.
3. Add diagnostics for confidence, freshness, and provenance.
4. Add tests for edits, invalidation, and persistence.

### Phase 5: Integration and observability

1. Wire the memory engine into agent loop boundaries.
2. Align memory with recovery checkpoints and token economy policies.
3. Add telemetry for retrieval latency, freshness, and quality.
4. Add end-to-end tests for memory-guided agent flows.

### Phase 6: Scheduler-driven maintenance and standalone deployment

1. Define scheduler-triggered maintenance jobs for compaction, synthesis, linting, pruning, and retrieval index refresh.
2. Expose standalone memory startup paths for MCP server and plugin consumers.
3. Add adapter tests for custom memory backends implementing the `MemoryProvider` / `MemoryBackend` contract.
4. Document hot / warm / cold retention mapping and how external stacks can reinterpret it.

---

## 7. Risk Mitigation & Best Practices

- Treat retrieved memory as untrusted until scrubbed and scoped.
- Never store raw LLM output as the only durable source of truth.
- Preserve the raw log even when wiki synthesis changes over time.
- Require explicit scope transitions for cross-project or cross-team reads.
- Keep the memory subsystem independent from token budgeting decisions.
- Make white-box editing available so users can correct mistakes.
- Validate that retrieval improves task quality instead of merely increasing context size.

---

## 8. Summary

`@agentsy/memory` should be the durable knowledge layer for Agentsy.

It will combine:

- raw event logs
- synthesized wiki knowledge
- semantic retrieval
- scope control
- white-box editing
- linter diagnostics
- safe context injection

The main goal is to preserve useful knowledge across agentic flows without turning memory into hidden orchestration or unchecked prompt pollution.
