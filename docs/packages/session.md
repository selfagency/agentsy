# `@agentsy/session`

Session management and conversation lifecycle — typed state, branching, checkpointing, crash recovery, and deterministic resume.

## Purpose

`@agentsy/session` manages the lifecycle of agent sessions — creation, suspension, resumption, and termination — along with session-scoped context and state boundaries. Phase 6 added a fully typed state layer with immutable reducers, checkpointing, branching, crash detection, and integrity validation.

## Status

Active development. API surface is stable within the current phase.

---

## Architecture

```text
SessionStore (pluggable persistence)
  └── SessionManager (typed state + reducers)
        ├── Checkpoints
        ├── Branching / fork
        ├── Crash detection
        ├── Integrity validation
        └── Pause/resume for approval gates
```

### SessionStore

Pluggable key-value interface for session persistence.

```typescript
export interface SessionStore {
  clear(): void;
  getState(): LegacySessionState;
  getValue<T = unknown>(key: string): T | undefined;
  listKeys(): string[];
  removeValue(key: string): void;
  setValue(key: string, value: unknown): void;
}
```

- **`createSessionStore(state)`** — In-memory store (default for tests)
- **`createFileStore(path?)`** — File-backed store (JSON, defaults to `~/.agentsy/sessions.json`)

### SessionManager

Typed, reducer-based state management on top of `SessionStore`.

```typescript
const manager = createSessionManager(store, { sessionId, threadId });

manager.apply({ type: 'appendMessage', message });
manager.saveCheckpoint('before-tool-call');
manager.fork();
manager.restoreCheckpoint('cp_1234567890_1');
manager.persist();
```

### Typed State Schema (Zod)

All state is validated at runtime against Zod schemas:

- **`SessionStateSchema`** — Top-level session (sessionId, threadId, messages, toolCallQueue, checkpoints, meta, timestamps)
- **`MessageSchema`** — Messages with role, content (string or content parts)
- **`ContentPartSchema`** — Discriminated union of text/image/tool-call/tool-result parts
- **`ToolCallSchema`** — Tool call queue entries with status tracking
- **`CheckpointSchema`** — Named or auto-checkpoints with message/tool-call counts

### Immutable Reducers

All state transitions go through pure reducer functions:

- `appendMessage`, `updateMessage`, `replaceMessages`, `truncateMessages`
- `addToolCall`, `updateToolCall`
- `addCheckpoint`
- `setMeta`
- `pinMessage`, `unpinMessage`
- `forkSession`, `updateTimestamps`

### Branching / Fork

```typescript
const child = manager.fork();
// child has new sessionId/threadId, parent links preserved
// Original manager is unaffected
```

### Checkpointing

```typescript
const cpId = manager.saveCheckpoint('before-expensive-operation');
const state = manager.loadCheckpoint(cpId);
manager.restoreCheckpoint(cpId); // returns new manager at that state
```

### Crash Detection & Recovery

```typescript
import {
  createCrashDetector,
  createSessionRestorer,
  validateIntegrity
} from '@agentsy/session';

// Detect stale sessions
const stale = detectStaleSessions(store, 3_600_000); // 1 hour

// Validate integrity
const result = validateIntegrity(state);
// result.valid, result.errors[], result.warnings[]

// Restore from checkpoint or create fresh
const restored = restoreSession(store, staleEntry, integrity);
```

### Pause/Resume for Approval Gates

```typescript
const pauseManager = createPauseManager();

// Pause a session, get a promise that resolves when unblocked
const resume = pauseManager.pause('session-1', 'Approval needed for tool call');
// ... elsewhere:
pauseManager.resolve('session-1', { approved: true });
// The promise resolves
```

---

## CLI Commands

```bash
agentsy sessions list                           # List all sessions
agentsy session <id>                            # Show session status
agentsy session <id> status                     # Show session details
agentsy session <id> checkpoint list            # List checkpoints
agentsy session <id> checkpoint restore <cpId>  # Restore to checkpoint
agentsy resume                                  # Detect + recover stale sessions
agentsy resume <sessionId>                      # Validate a specific session
```

---

## Fork / Branch Patterns

1. **Safe experimentation** — Fork a session before trying a risky tool call; roll back via checkpoint restore
2. **Compare strategies** — Fork at decision point, run each branch independently
3. **Recovery** — On crash, restore to last good checkpoint; if state is corrupt, start fresh with crash metadata

---

## Resume Guarantees

- Deterministic replay through immutable reducers (same actions → same state)
- Checkpoint-based rollback (most recent valid checkpoint wins)
- Integrity validator catches schema violations, role alternation, timeline issues
- Crash detector uses heartbeat keys with configurable timeouts
- File-backed store persists across process restarts

---

## Dependencies

- `zod` — Runtime schema validation
- `@agentsy/types` — Shared type definitions
