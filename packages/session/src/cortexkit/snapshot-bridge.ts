import type { Database } from 'better-sqlite3';
import type { SessionSnapshot } from '../store.js';

/**
 * Read Magic Context compartments and produce a SessionSnapshot.
 * This bridges MC's tiered history into the session durability framework for
 * crash recovery and integrity verification (Phase 21).
 */
export function createCortexKitSnapshotBridge(db: Database) {
  return {
    /**
     * Build a snapshot from the latest compartments for a session.
     */
    readCompartments(sessionId: string): {
      compartments: number;
      latestSeq: number;
      latestP1?: string;
    } {
      const row = db
        .prepare(
          `SELECT seq, p1 FROM compartments
           WHERE session_id = ?
           ORDER BY seq DESC
           LIMIT 1`
        )
        .get(sessionId) as { seq: number; p1: string } | undefined;

      if (!row) return { compartments: 0, latestSeq: 0 };

      const count = db.prepare('SELECT COUNT(*) as cnt FROM compartments WHERE session_id = ?').get(sessionId) as {
        cnt: number;
      };

      return {
        compartments: count.cnt,
        latestSeq: row.seq,
        latestP1: row.p1
      };
    },

    /**
     * Read the current project memory epoch for integrity checks.
     */
    readMemoryEpoch(projectPath: string): number {
      const row = db
        .prepare('SELECT project_memory_epoch FROM project_state WHERE project_path = ?')
        .get(projectPath) as { project_memory_epoch: number } | undefined;
      return row?.project_memory_epoch ?? 0;
    }
  };
}
