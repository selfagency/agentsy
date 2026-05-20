---
goal: @agentsy/session production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: session-maintainers
status: In progress
tags: [feature, architecture, session, durability, resume]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/session` as session durability and deterministic resume authority.

## 1. Requirements & Constraints

- **REQ-SESSION-001**: Session snapshots preserve state required for deterministic resume/replay.
- **REQ-SESSION-002**: Session stores support file/database backends with consistent semantics.
- **REQ-SESSION-003**: Checkpoint APIs support explicit and automatic save pathways.
- **REQ-SESSION-004**: Stale/crash detection and recovery guidance are available to operators.
- **SEC-SESSION-001**: Session persistence redacts or references secrets, never stores raw credentials.
- **SEC-SESSION-002**: Snapshot integrity/tamper checks run before restore.
- **CON-SESSION-001**: Long-horizon knowledge remains in `@agentsy/memory`.
- **CON-SESSION-002**: Runtime execution semantics remain in `@agentsy/runtime`.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-SESSION-001: Contract and store interface stabilization.

| Task             | Description                                                          | Completed | Date       |
| ---------------- | -------------------------------------------------------------------- | --------- | ---------- |
| TASK-SESSION-001 | Stabilize snapshot schema and store interface contract.              | ✅        | 2026-05-17 |
| TASK-SESSION-002 | Add typed tests for deterministic resume and metadata compatibility. | ✅        | 2026-05-17 |
| TASK-SESSION-003 | Document boundaries with runtime/memory/CLI.                         | ✅        | 2026-05-17 |

### Implementation Phase 2

- GOAL-SESSION-002: Core durability implementation.

| Task             | Description                                                   | Completed | Date       |
| ---------------- | ------------------------------------------------------------- | --------- | ---------- |
| TASK-SESSION-004 | Implement save/resume/checkpoint APIs and backend adapters.   | ✅        | 2026-05-17 |
| TASK-SESSION-005 | Implement integrity checks and stale/crash detection signals. | ✅        | 2026-05-17 |
| TASK-SESSION-006 | Implement metadata pathways for layout/context reuse fields.  | ✅        | 2026-05-17 |

### Implementation Phase 3

- GOAL-SESSION-003: Integration and replay validation.

| Task             | Description                                                              | Completed | Date |
| ---------------- | ------------------------------------------------------------------------ | --------- | ---- |
| TASK-SESSION-007 | Integrate runtime loop persistence and CLI resume workflows.             |           |      |
| TASK-SESSION-008 | Add integration tests for interruption/restart and deterministic replay. |           |      |
| TASK-SESSION-009 | Validate memory/runtime boundary behavior across resume operations.      |           |      |

### Implementation Phase 4

- GOAL-SESSION-004: Hardening and release gates.

| Task             | Description                                                                   | Completed | Date |
| ---------------- | ----------------------------------------------------------------------------- | --------- | ---- |
| TASK-SESSION-010 | Add regressions for corruption, compatibility upgrade, and concurrency edges. |           |      |
| TASK-SESSION-011 | Align docs/examples for operational session workflows.                        |           |      |
| TASK-SESSION-012 | Pass package and monorepo release gates.                                      |           |      |

## 3. Acceptance Criteria

- **ACC-SESSION-001**: Deterministic resume and integrity checks are validated.
- **ACC-SESSION-002**: Runtime/CLI integrations pass end-to-end tests.
- **ACC-SESSION-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/session.md`
- `packages/session/README.md`
- `packages/session/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/session — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/session` is the **durability layer** of the framework. It ensures that agent interactions are not lost when a process exits, a network fails, or a crash occurs. It provides the mechanisms to serialize the full state of an agent loop, including message history, tool results, and working memory, and restore it with byte-perfect fidelity.

It sits alongside `@agentsy/memory`, providing the short-term, task-specific durable state, whereas memory provides long-term, cross-session knowledge.

### Ecosystem Sketch

```text
[ @agentsy/runtime ] <--- Snapshot / Resume
         |
         v
[ @agentsy/session ] <--- Persistence Logic
         |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
 [ Local File Store ]    [ SQLite Store ]        [ Remote Store ]
 (Atomic .tmp -> rename) (Structured Query)      (Future)
```

## Fulfillment of Role

The package fulfills its role by implementing a robust session lifecycle:

1. **Atomic Writes**: Uses the `.tmp` → verify → rename pattern to prevent partial state corruption.
2. **Integrity Verification**: SHA-256 checksums on all snapshots to detect disk corruption or tampering.
3. **Versioned Serialization**: Schema versions in snapshots to allow for safe migrations when package versions change.
4. **Crash Detection**: Heuristics to detect "stale active" sessions and flag them for recovery.

## Detailed Functionality

### 1. Session State (`src/state/`)

- **Responsibility**: Representation of the agent's current progress.
- **Components**:
  - `id`: Unique `SessionId`.
  - `agentId`: Link to the agent configuration.
  - `history`: Full conversation history.
  - `toolState`: Current status of pending or executed tools.
  - `memory`: Working memory snapshot.
  - `taskBoard`: Active task/checklist/todo state for the current run.
  - `status`: `active | paused | completed | crashed`.

### 2. Session Store (`src/store/`)

- **Mechanism**: Pluggable storage backends (File, SQLite, Memory).
- **Functionality**:
  - `save`: Atomic persistence of a `SessionSnapshot`.
  - `load`: Retrieval and checksum verification.
  - `list`: Querying sessions by scope or agent ID.

Session should prefer SQLite when available for active-session durability and fast resume, but it does **not** own background job queues or scheduler semantics.

Consumer-selectable durability backends should include:

- SQLite (preferred default)
- plaintext/file snapshots for simple local installs and debugging
- PostgreSQL for shared/distributed durability when explicitly configured

### 3. Manager (`src/manager/`)

- **Responsibility**: Lifecycle orchestration.
- **Key Logic**:
  - `autoSnapshot`: Periodic snapshots during long runs.
  - `detectCrash`: Finding sessions with an `active` status but a stale heartbeat timestamp.
  - `resume`: Reconstituting an `@agentsy/runtime` loop from a snapshot.

### 4. Cache checkpointing for reusable context (LMCache-inspired)

Sessions should carry enough metadata for the runtime to reuse stable context segments across resumes.

#### What to capture

- the active model family / provider family used when the snapshot was taken
- stable prompt fingerprints for system prompts, policy blocks, and tool schemas
- the set of reusable context segments that were already assembled
- invalidation keys that would force a fresh assembly on resume

#### Why it matters

This lets the runtime decide whether a resumed session can reuse previously assembled context blocks or should rebuild them from memory. The goal is not raw cache internals; it is to preserve reuse opportunities across snapshot/resume boundaries.

### 5. Task-board persistence boundary

- Session snapshots should store the active task board, checklist, pending plan steps, and UI-visible todos needed to resume an in-flight run.
- Session is the durability layer for the **current** run's task state.
- Session is not the owner of scheduler/job semantics; that remains in `@agentsy/orchestrator`.
- If the SQLite backend is available, use it as the preferred backing store for task-board snapshots and resume metadata.

## Logic & Data Flow

### 1. Persistence Flow (Snapshot)

1. At a milestone (e.g., turn complete), `@agentsy/runtime` calls `SessionManager.snapshot()`.
2. The manager creates a `SessionSnapshot` containing the current state, timestamp, and schema version.
3. The snapshot is serialized to JSON and a SHA-256 checksum is calculated.
4. The snapshot is written to a `.tmp` file, verified, and then renamed to the canonical path.

### 2. Recovery Flow (Resume)

1. Application calls `SessionManager.resume(sessionId)`.
2. The manager loads the latest snapshot from the store.
3. Checksum is verified; if invalid, it falls back to the previous snapshot or throws.
4. Schema version is checked; if older, migration logic is applied.
5. The reconstituted state is returned to the runtime to re-initialize the agent loop.

## Key Interfaces

### SessionStore

```typescript
export interface SessionStore {
  save(snapshot: SessionSnapshot): Promise<void>;
  load(id: SessionId): Promise<SessionSnapshot | undefined>;
  list(filter: SessionFilter): Promise<SessionState[]>;
  delete(id: SessionId): Promise<void>;
  checkExists(id: SessionId): Promise<boolean>;
}
```

### SessionSnapshot

```typescript
export interface SessionSnapshot {
  sessionId: SessionId;
  timestamp: Date;
  checksum: string;
  state: SessionState;
  schemaVersion: number;
}
```

## Implementation Details

### Atomic Write Pattern

```typescript
async function atomicWrite(path: string, content: string) {
  const tmpPath = `${path}.tmp`;
  await fs.writeFile(tmpPath, content);
  const verify = await fs.readFile(tmpPath, 'utf-8');
  if (verify !== content) throw new Error('Write verification failed');
  await fs.rename(tmpPath, path);
}
```

### Heartbeat Mechanism

Active sessions must update a `heartbeat` timestamp in the snapshot. The `detectCrash` logic uses a configurable `CRASH_THRESHOLD` (e.g., 2x the heartbeat interval) to identify dead processes.

## Sources Synthesized

`agentsy-prd.md`, `agentsy-deep-dive-v2.md`, `implementation-plan.md`, `agentsy-testing-plan.md`, `packages/session/IMPLEMENTATION-PLAN.md`.

- Heartbeat timestamps in session state
- Lock files to detect active sessions
- State validation on load
- Automatic recovery from last known good state

### Multi-level Scoping

- **user**: Personal user sessions
- **project**: Project-specific sessions
- **team**: Team-shared sessions
- **global**: System-wide sessions

#### Storage Backends

- **File System** (Default)
  - JSON files with atomic writes
  - Directory-based organization by scope
  - Compression for large snapshots
- **Database** (Optional)
  - SQLite for higher performance
  - Index on agentId, scope, status
  - Transaction support for consistency

### Dependencies

- Internal: `@agentsy/types` - Core interfaces
- External: Database drivers (optional)
- External: Compression libraries
- External: Crypto libraries for checksums

### Test Strategy

- Atomic write simulation tests
- Crash scenario testing
- Data integrity validation
- Cross-platform file system tests
- Performance benchmarks

### Co-development Dependencies

- `agentic-loop` - Session lifecycle integration
- `runtime` - Crash detection and recovery
- `memory` - Session persistence in memory store
- `cli` - Session management commands

### Source Plan References

- `plan/agentsy-tech.md` §4.7 - Session persistence strategy
- `plan/agentsy-runtime.md` §3.2 - Crash recovery mechanisms
- `plan/agentsy-agents-v1.md` §4.1 - Session lifecycle management

### Implementation Milestones

#### Phase 1: Core Session Management

- [ ] SessionState and SessionSnapshot interfaces
- [ ] FileSystem session store implementation
- [ ] Atomic write mechanism (.tmp → rename)
- [ ] Basic SessionManager class
- [ ] Session CRUD operations

#### Phase 2: Crash Recovery

- [ ] Heartbeat mechanism for active sessions
- [ ] Lock file management
- [ ] Crash detection logic
- [ ] Automatic recovery procedures
- [ ] Data integrity validation

#### Phase 3: Advanced Features

- [ ] Multi-level session scoping
- [ ] Snapshot compression
- [ ] Database session store (SQLite)
- [ ] Session cleanup and maintenance
- [ ] Performance optimizations

#### Phase 4: Integration & Tooling

- [ ] CLI session commands
- [ ] Runtime integration hooks
- [ ] Memory store integration
- [ ] Monitoring and diagnostics
- [ ] Migration tools from old session formats

#### Phase 5: Cache-aware resume metadata

- [ ] Persist reusable context fingerprints in session snapshots
- [ ] Record model-family and prompt-template invalidation keys
- [ ] Restore cache-eligible context segments on resume when safe
- [ ] Add telemetry for session-resume context reuse

### File Structure

```text
packages/session/src/
├── index.ts                    # Public exports
├── core/
│   ├── session.ts             # SessionState and SessionSnapshot
│   ├── store.ts               # SessionStore interface
│   └── manager.ts             # SessionManager implementation
├── stores/
│   ├── filesystem.ts          # File system session store
│   ├── database.ts            # SQLite session store
│   └── index.ts               # Store factory
├── recovery/
│   ├── detector.ts            # Crash detection
│   ├── restorer.ts            # Session restoration
│   └── validator.ts           # Data integrity validation
├── utils/
│   ├── atomic.ts              # Atomic write operations
│   ├── compression.ts         # Snapshot compression
│   └── crypto.ts              # Checksums and validation
└── cli/
    └── commands.ts            # Session management CLI
```

### Verification Criteria

- [ ] All session operations are atomic
- [ ] Crash recovery works in all scenarios
- [ ] Data integrity maintained across failures
- [ ] Performance meets requirements (<10ms for state updates)
- [ ] Multi-level scoping works correctly
- [ ] Cross-platform compatibility validated

### Risk Register

- **Medium**: File system atomicity edge cases
- **Medium**: Lock file contention in concurrent scenarios
- **Low**: Database migration complexity
- **Low**: Performance degradation with large sessions

## Priorities

1. Stabilize snapshot/resume contracts with @agentsy/runtime.
2. **Checkpointing System**: Implement a `BaseCheckpointStore` abstraction for explicit state graphs with versioning (LangGraph pattern).
3. **Incremental Persistence**: Support for saving only the diffs between snapshots to optimize storage and performance.
4. **Rollback & Recovery**: Ability to rollback to any previous checkpoint in a session's history.
5. **Pluggable Backends**: SQLite (default), Redis, and PostgreSQl for distributed session management.

---

## Scheduler/Task Durability Boundary

Session persistence may be used to snapshot **active run state** associated with orchestrator-managed work, but it is not the owner of scheduler persistence semantics.

### What session may store

- active task-board/checklist state for the current run
- resume metadata for in-flight orchestrator jobs
- heartbeat/lease metadata needed to restore an interrupted local execution

### What session does not own

- recurring schedule definitions
- queue semantics and dequeue/ack/retry behavior
- cron driver selection
- multi-run task registry ownership

Those concerns remain in `@agentsy/orchestrator`, which may choose SQLite/honker, PostgreSQL, or plaintext/file backends beneath its own scheduler abstraction.

### Security constraints

- Path sanitization with `path.resolve` and root-prefix validation.
- Reject traversal attempts (`../`, symlink escape).
- Task payloads treated as untrusted at execution boundary (sanitized in orchestrator runner).

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Session store contract highlights

```typescript
interface SessionStore {
  saveUser(sessionId: string, message: ModelMessage): Promise<void>;
  saveAssistant(sessionId: string, message: ModelMessage): void;
  save(sessionId: string, snapshot: StreamSnapshot): Promise<void>;
  load(sessionId: string): Promise<StreamSnapshot | null>;
  loadAsSnapshot(sessionId: string): Promise<{ messages: ModelMessage[] } | null>;
}
```

### Durability invariants

- User-turn writes are blocking.
- Assistant-turn writes are queued/fire-and-forget but ordered.
- Atomic write pattern remains mandatory (`.tmp` -> verify -> rename).
- Startup orphan-temp repair remains part of store boot responsibilities.
