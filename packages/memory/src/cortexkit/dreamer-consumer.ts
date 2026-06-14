/**
 * Dreamer post-task consumer.
 *
 * Detects when Magic Context's dreamer has consolidated/archived memories
 * by polling the `project_state.project_memory_epoch` counter. When a change
 * is detected, syncs new project memories through the bridge into the wiki.
 */

import {
  PROJECT_MEMORIES_COLUMNS,
  PROJECT_MEMORIES_TABLE,
  PROJECT_STATE_COLUMNS,
  PROJECT_STATE_TABLE
} from '@agentsy/shared/cortexkit';
import type { Database } from 'better-sqlite3';

/** A single record from MC's project_memories table. */
interface McMemory {
  category: string;
  content: string;
  created_at: string;
  id: number;
  importance: number;
  updated_at: string;
}

/** Mapping from MC 5-category taxonomy to wiki entity kind. */
const MC_TO_WIKI_KIND: Record<string, string> = {
  ARCHITECTURE: 'architecture',
  CONFIG_VALUES: 'config',
  CONSTRAINTS: 'constraint',
  NAMING: 'naming',
  PROJECT_RULES: 'rule'
};

export interface WikiUpserter {
  upsertPage(input: {
    actorId?: string;
    body: string;
    format: 'markdown' | 'text';
    pageId: string;
    tags: string[];
    title: string;
  }): Promise<unknown>;
}

export interface DreamerConsumerOptions {
  actorId?: string;
  db: Database;
  projectPath: string;
  wiki: WikiUpserter;
}

export interface DreamerConsumerState {
  /**
   * The last known epoch value. The consumer compares against this to
   * detect new dreamer runs. Initialise with the current value on boot.
   */
  lastKnownEpoch: number;
}

/**
 * Create a dreamer post-task consumer.
 *
 * Call `checkAndSync()` periodically (e.g. every 30s or after each turn)
 * to detect new dreamer activity and sync consolidated memories to the wiki.
 */
export function createDreamerConsumer(options: DreamerConsumerOptions): {
  checkAndSync: () => Promise<{ synced: number; skipped: number }>;
  state: DreamerConsumerState;
} {
  const { db, wiki, projectPath } = options;
  const actorId = options.actorId ?? 'dreamer-consumer';
  const state: DreamerConsumerState = {
    lastKnownEpoch: readCurrentEpoch(db, projectPath)
  };

  return {
    state,

    async checkAndSync() {
      const currentEpoch = readCurrentEpoch(db, projectPath);

      if (currentEpoch <= state.lastKnownEpoch) {
        return { synced: 0, skipped: 0 };
      }

      // Epoch changed — dreamer consolidated. Read all current memories.
      const memories = readMemories(db, projectPath);
      let synced = 0;
      let skipped = 0;

      for (const memory of memories) {
        // Skip low-importance noise
        if (memory.importance < 0.3) {
          skipped++;
          continue;
        }

        const mcCategory = memory.category;
        // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection
        const kind = Object.hasOwn(MC_TO_WIKI_KIND, mcCategory) ? (MC_TO_WIKI_KIND[mcCategory] as string) : 'note';
        const pageId = `mc-memory-${memory.id}`;

        try {
          await wiki.upsertPage({
            actorId,
            body: memory.content,
            format: 'text',
            pageId,
            tags: ['dreamer-synced', kind],
            title: `${kind}: ${memory.content.slice(0, 60)}`
          });
          synced++;
        } catch {
          skipped++;
        }
      }

      state.lastKnownEpoch = currentEpoch;
      return { synced, skipped };
    }
  };
}

function readCurrentEpoch(db: Database, projectPath: string): number {
  const row = db
    .prepare(
      `SELECT ${PROJECT_STATE_COLUMNS.projectMemoryEpoch}
       FROM ${PROJECT_STATE_TABLE}
       WHERE ${PROJECT_STATE_COLUMNS.projectPath} = ?`
    )
    .get(projectPath) as { project_memory_epoch: number } | undefined;
  return row?.project_memory_epoch ?? 0;
}

function readMemories(db: Database, projectPath: string): McMemory[] {
  const { category, content, createdAt, id, importance, updatedAt } = PROJECT_MEMORIES_COLUMNS;
  return db
    .prepare(
      `SELECT ${id}, ${content}, ${category}, ${importance}, ${createdAt}, ${updatedAt}
       FROM ${PROJECT_MEMORIES_TABLE}
       WHERE ${PROJECT_MEMORIES_COLUMNS.projectPath} = ?
       ORDER BY ${importance} DESC`
    )
    .all(projectPath) as McMemory[];
}
