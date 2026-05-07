# IMPLEMENTATION-PLAN.md

## Package: @agentsy/session

### Overview
Crash-safe session persistence and resumption for @agentsy agents. Provides atomic state management, recovery mechanisms, and session lifecycle handling across agent executions.

### Current Status
🔄 **Stub** - Package exists but needs full implementation

### Core Responsibilities
- Atomic session state persistence
- Crash recovery and session resumption
- Session lifecycle management
- State serialization/deserialization
- Multi-level session scoping

### Public API Design
```typescript
// Session state representation
export interface SessionState {
  id: string
  createdAt: Date
  updatedAt: Date
  agentId: string
  scope: 'user' | 'project' | 'team' | 'global'
  metadata: Record<string, unknown>
  data: Record<string, unknown>
  snapshots: SessionSnapshot[]
  status: 'active' | 'paused' | 'completed' | 'crashed'
}

// Session snapshot for recovery
export interface SessionSnapshot {
  id: string
  timestamp: Date
  state: Record<string, unknown>
  checksum: string
  compressed: boolean
}

// Session store abstraction
export interface SessionStore {
  create(session: Omit<SessionState, 'id' | 'createdAt' | 'updatedAt'>): Promise<SessionState>
  get(id: string): Promise<SessionState | null>
  update(id: string, updates: Partial<SessionState>): Promise<SessionState>
  delete(id: string): Promise<void>
  list(agentId?: string, scope?: SessionScope): Promise<SessionState[]>
  createSnapshot(sessionId: string, state: Record<string, unknown>): Promise<SessionSnapshot>
  restoreFromSnapshot(snapshotId: string): Promise<SessionSnapshot>
}

// Session management
export class SessionManager {
  constructor(store: SessionStore, options?: SessionManagerOptions)
  
  // Session lifecycle
  createSession(config: SessionConfig): Promise<SessionState>
  resumeSession(id: string): Promise<SessionState | null>
  pauseSession(id: string): Promise<SessionState>
  completeSession(id: string): Promise<SessionState>
  
  // State management
  updateState(id: string, updates: Record<string, unknown>): Promise<void>
  getState(id: string): Promise<Record<string, unknown>>
  
  // Crash recovery
  detectCrashedSessions(): Promise<SessionState[]>
  recoverSession(sessionId: string, snapshotId?: string): Promise<SessionState>
  
  // Cleanup
  cleanupOldSessions(maxAge?: Duration): Promise<void>
}

// Session configuration
export interface SessionConfig {
  agentId: string
  scope: SessionScope
  metadata?: Record<string, unknown>
  autoSnapshot?: boolean
  snapshotInterval?: Duration
  maxSnapshots?: number
}
```

### Implementation Strategy

#### Atomic State Persistence
- Use `.tmp` → rename pattern for atomic writes
- SHA-256 checksums for data integrity
- Compressed snapshots for space efficiency
- Journal-like append-only log for changes

#### Crash Detection
- Heartbeat timestamps in session state
- Lock files to detect active sessions
- State validation on load
- Automatic recovery from last known good state

#### Multi-level Scoping
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

### File Structure
```
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