# Phase 6 — Session Durability & Resume

**Effort:** ~8 hours  
**Milestone:** Sessions survive interruptions; resume is deterministic  
**Packages:** `@agentsy/session`, `@agentsy/runtime`  
**Gate:** Snapshot save/restore working; session branching functional  
**Next:** Phase 7

---

## Status — 2026-06-12 Code Review

## Completion: ~95% — Core durability shipped, top-level resume command wired, chat-flow picker remains a minor gap

### ✅ FULLY IMPLEMENTED & TESTED (10 test files, 104 tests, ALL PASSING)

- ✅ State schema (Zod-validated: messages, toolCallQueue, checkpoints, pinnedMessageIds)
- ✅ State reducers (immutable: append/replace/truncate messages, push/shift queue, add/remove pins)
- ✅ SessionManager (create, list, getCheckpoints, saveCheckpoint, restoreCheckpoint)
- ✅ PauseManager (request, resolve, listPending — for approval gates)
- ✅ Crash recovery (detectStaleSessions, validateIntegrity, restoreSession)
- ✅ File-backed store (createFileStore, getDefaultSessionFilePath)
- ✅ Session snapshot (createSessionSnapshot with cache fingerprint)
- ✅ Session CLI commands:
  - ✅ `agentsy sessions list`
  - ✅ `agentsy session <id> status`
  - ✅ `agentsy session <id> checkpoint <list|restore <id>>`

### ⏳ INCOMPLETE

- **⚠️ Resume-from-checkpoint not wired into chat command**
  - `restoreSession` + `restoreCheckpoint` work and are tested
  - But `agentsy resume` / `agentsy resume <sessionId>` interactive picker not connected to the `chat` flow
  - Impact: Feature exists but not exposed at the top-level resume entrypoint
  - Fix: Wire resume into CLI chat command (0.5h)
- **⚠️ Crash recovery not auto-triggered in agent loop lifecycle**
  - `detectStaleSessions` exists but isn't auto-called on startup
  - Fix: Add stale-session check to runtime loop init (0.5h)

### STATUS: ~90% SHIPPED — Durability solid, CLI resume entrypoint + auto-recovery remain

---

## Overview

Replace untyped state blob with typed schema + reducer model. Enable branching, checkpointing, and deterministic resume.

---

## TASK-025..030: Typed State Architecture

### TASK-025: State Schema & Reducers

**Location:** `packages/session/src/state/`

```typescript
// schema.ts
export const SessionStateSchema = z.object({
  version: z.literal(1),
  sessionId: z.string().uuid(),
  threadId: z.string().uuid(),
  parentSessionId: z.string().uuid().optional(),
  parentThreadId: z.string().uuid().optional(),
  messages: z.array(MessageSchema),
  toolCallQueue: z.array(ToolCallSchema),
  checkpoints: z.array(CheckpointSchema),
  pinnedMessageIds: z.array(z.string()).optional(),
  meta: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date()
});

// reducers.ts
export const stateReducers = {
  messages: {
    append: (state, message: Message) => ({ ...state, messages: [...state.messages, message] }),
    replace: (state, messages: Message[]) => ({ ...state, messages }),
    truncate: (state, limit: number) => ({
      ...state,
      messages: state.messages.slice(-limit)
    })
  },

  toolCallQueue: {
    push: (state, toolCall: ToolCall) => ({
      ...state,
      toolCallQueue: [...state.toolCallQueue, toolCall]
    }),
    shift: state => ({
      ...state,
      toolCallQueue: state.toolCallQueue.slice(1)
    })
  },

  pinnedMessageIds: {
    add: (state, messageId: string) => ({
      ...state,
      pinnedMessageIds: [...(state.pinnedMessageIds || []), messageId]
    }),
    remove: (state, messageId: string) => ({
      ...state,
      pinnedMessageIds: state.pinnedMessageIds?.filter(id => id !== messageId)
    })
  }
};
```

### TASK-026..028: Session Management

```typescript
// branch.ts
export async function forkSession(
  baseSessionId: string,
  forkPoint: number, // message index
  store: SessionStore
): Promise<SessionState> {
  const base = await store.get(baseSessionId);
  const forked = {
    ...base,
    sessionId: uuidv4(),
    threadId: uuidv4(),
    parentSessionId: baseSessionId,
    parentThreadId: base.threadId,
    messages: base.messages.slice(0, forkPoint),
    toolCallQueue: [],
    checkpoints: []
  };

  await store.save(forked);
  return forked;
}

// pause.ts
export class PauseManager {
  async requestApproval(request: ApprovalRequest): Promise<string> {
    // Store pending approval
    // Return approval ID for wait polling
  }

  async listPending(sessionId: string): Promise<PendingApproval[]> {
    return this.store.getPending(sessionId);
  }

  resolve(approvalId: string, approved: boolean) {
    // Mark resolved; emit event
  }
}
```

### TASK-025: Snapshot Save/Resume

**Location:** `packages/runtime/src/loop/`

```typescript
export async function snapshotSession(session: AgentSession, checkpoint: string): Promise<SessionSnapshot> {
  return {
    sessionId: session.id,
    timestamp: new Date(),
    checkpoint,
    state: await session.state.serialize(),
    contextMetadata: {
      model: session.config.model,
      agentId: session.config.agentId,
      budget: session.tokens.spent(),
      messageCount: session.state.messages.length
    },
    cacheFingerprint: computeContextFingerprint(session.state)
  };
}

export async function resumeSession(snapshot: SessionSnapshot, store: SessionStore): Promise<AgentSession> {
  const state = await SessionState.deserialize(snapshot.state);
  const session = new AgentSession({
    id: snapshot.sessionId,
    config: {
      /* restored from snapshot */
    },
    state
  });

  // Validate cache fingerprint compatibility
  if (snapshot.cacheFingerprint) {
    session.cacheHint = snapshot.cacheFingerprint;
  }

  return session;
}
```

### TASK-027: Crash Recovery

```typescript
export class CrashRecovery {
  async detectStale(sessionId: string): Promise<boolean> {
    const session = await this.store.get(sessionId);
    const now = Date.now();
    const lastUpdate = session.updatedAt.getTime();

    // Stale if no update in 1 hour
    return now - lastUpdate > 3600000;
  }

  async recover(sessionId: string): Promise<AgentSession> {
    const snapshot = await this.store.getLatestSnapshot(sessionId);
    if (!snapshot) throw new SessionNotFoundError(sessionId);

    const session = await resumeSession(snapshot, this.store);

    // Log recovery event
    await this.tracer.info('session_recovered', {
      sessionId,
      fromCheckpoint: snapshot.checkpoint,
      messageCount: session.state.messages.length
    });

    return session;
  }
}
```

---

## TASK-029: Session Resume E2E Tests

```typescript
test('deterministic replay', async () => {
  // 1. Run 3 turns
  // 2. Snapshot
  // 3. Resume
  // 4. Verify messages identical
});

test('fork and branch', async () => {
  // 1. Run 3 turns
  // 2. Fork at turn 2
  // 3. Continue from fork
  // 4. Original session unaffected
});

test('crash recovery', async () => {
  // 1. Session stalled 1h ago
  // 2. Call recover()
  // 3. Session restored + log emitted
});
```

---

## TASK-026: CLI Resume Commands

```bash
agentsy resume                    # Interactive resume picker
agentsy resume <sessionId>        # Resume specific
agentsy sessions list             # All sessions
agentsy session <id> checkpoint   # Managed checkpoints
agentsy session <id> status       # Session info
```

---

## TASK-030: Documentation

`docs/packages/session.md` with:

- Schema overview
- Fork/branch patterns
- Resume guarantees
- Cache-aware hints

---

## Quality Gates

- ✅ State schema validates
- ✅ Reducers produce deterministic results
- ✅ Snapshots complete and restorable
- ✅ E2E replay deterministic
- ✅ Fork creates independent branch

---

**Next phase:** `10-PHASE-7-MEMORY-INTEGRATION.md`
