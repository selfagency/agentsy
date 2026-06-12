/**
 * Schema constants for Magic Context's shared SQLite tables.
 *
 * These table/column names match @cortexkit/magic-context's internal schema.
 * Access the database through openCortexKitDb() from ./db.js.
 */

/** Per-project durable knowledge (5-category taxonomy). */
export const PROJECT_MEMORIES_TABLE = 'project_memories';

export const PROJECT_MEMORIES_COLUMNS = {
  id: 'id',
  projectPath: 'project_path',
  content: 'content',
  category: 'category' as const, // ARCHITECTURE | CONSTRAINTS | CONFIG_VALUES | NAMING | PROJECT_RULES
  importance: 'importance',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
} as const;

/** Tiered session history compartments. */
export const COMPARTMENTS_TABLE = 'compartments';

export const COMPARTMENTS_COLUMNS = {
  id: 'id',
  sessionId: 'session_id',
  p1: 'p1', // Verbose
  p2: 'p2', // Normal
  p3: 'p3', // Terse
  p4: 'p4', // Anchor-only
  importance: 'importance',
  episodeType: 'episode_type',
  seq: 'seq', // Monotonic sequence number
  createdAt: 'created_at'
} as const;

/** Per-session persisted metadata. */
export const SESSION_META_TABLE = 'session_meta';

export const SESSION_META_COLUMNS = {
  sessionId: 'session_id',
  key: 'key',
  value: 'value' // JSON blob
} as const;

/** Project memory epoch tracker (bumped on dashboard/external mutation). */
export const PROJECT_STATE_TABLE = 'project_state';

export const PROJECT_STATE_COLUMNS = {
  projectPath: 'project_path',
  projectMemoryEpoch: 'project_memory_epoch',
  updatedAt: 'updated_at'
} as const;
