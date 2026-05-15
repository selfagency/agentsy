# @agentsy/session — Implementation Plan

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
  - `status`: `active | paused | completed | crashed`.

### 2. Session Store (`src/store/`)

- **Mechanism**: Pluggable storage backends (File, SQLite, Memory).
- **Functionality**:
  - `save`: Atomic persistence of a `SessionSnapshot`.
  - `load`: Retrieval and checksum verification.
  - `list`: Querying sessions by scope or agent ID.

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

## Scheduled Task Persistence (migrated from `plan/agentsy-scheduler-v1.md`)

Session storage will also host scheduler persistence concerns so we do not introduce a standalone scheduler package.

### Planned additions

- `TaskStore` abstraction alongside existing session persistence.
- `InMemoryTaskStore` for tests/ephemeral runs.
- `FileTaskStore` default path: `~/.agentsy/tasks/<taskId>.json` (or `AGENTSY_TASK_STORE_PATH`).
- Atomic writes (`temp + rename`) with file locking for concurrent writer safety.
- Restore support: load pending/running tasks on process boot and hand back to orchestrator scheduler module.

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
