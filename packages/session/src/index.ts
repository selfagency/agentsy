/**
 * @agentsy/session — Session persistence, serialization, and branching
 *
 * ## Packages
 *
 * - {@link ./state/index.ts | state } — Zod-validated typed state schema + immutable reducers
 * - {@link ./store.ts | store }     — Key-value session store backed by in-memory maps
 *
 * @module
 */

// Session lifecycle management (Phase 6)
export {
  type CheckpointInfo,
  createSessionManager,
  type SessionManager,
  type SessionManagerOptions
} from './manager.js';
// Pause/resume for approval gates and interruptions
export { createPauseManager, type PauseEntry, type PauseManager } from './pause.js';
// Typed state layer (Phase 6)
export * from './state/index.js';
export {
  type CreateSessionSnapshotInput,
  createSessionSnapshot,
  createSessionStore,
  type ReusableSessionSegment,
  type SessionSnapshot,
  type SessionState as LegacySessionState,
  type SessionStore
} from './store.js';
