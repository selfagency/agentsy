import type { Database } from 'better-sqlite3';

/**
 * Category mapping: MC's 5-category taxonomy → our wiki/entity kinds.
 */
const MC_TO_WIKI_CATEGORY: Record<string, string> = {
  PROJECT_RULES: 'rule',
  ARCHITECTURE: 'architecture',
  CONSTRAINTS: 'constraint',
  CONFIG_VALUES: 'config',
  NAMING: 'naming'
};

/** A single record from MC's project_memories table. */
interface McMemory {
  category: string;
  content: string;
  created_at: string;
  id: number;
  importance: number;
  updated_at: string;
}

/**
 * Bridge that promotes Magic Context project memories into @agentsy/memory's wiki.
 *
 * Reads MC's project_memories table and makes them available for wiki ingestion.
 * Does NOT require wiki at compile time — consumer passes a callback to upsert.
 */
export function createMemoryBridge(db: Database) {
  return {
    /**
     * Read all MC project memories for a given project path.
     */
    readMemories(projectPath: string): McMemory[] {
      const rows = db
        .prepare(
          `SELECT id, content, category, importance, created_at, updated_at
           FROM project_memories
           WHERE project_path = ?
           ORDER BY importance DESC`
        )
        .all(projectPath) as McMemory[];

      return rows;
    },

    /**
     * Map MC category to wiki entity kind.
     */
    mapCategory(mcCategory: string): string {
      if (Object.hasOwn(MC_TO_WIKI_CATEGORY, mcCategory)) {
        return MC_TO_WIKI_CATEGORY[mcCategory] as string;
      }
      return 'note';
    },

    /**
     * Build a wiki-ready input from a MC memory record.
     */
    toWikiEntry(memory: McMemory): {
      content: string;
      kind: string;
      importance: number;
    } {
      return {
        content: memory.content,
        kind: this.mapCategory(memory.category),
        importance: memory.importance
      };
    },

    /**
     * Promote all memories for a project via a callback.
     *
     * Example:
     *   bridge.promoteMemories('/path/to/project', async (entry) => {
     *     await wikiManager.createPage({ ...entry });
     *   });
     */
    async promoteMemories(
      projectPath: string,
      onMemory: (entry: { content: string; kind: string; importance: number }) => Promise<void>
    ): Promise<{ promoted: number; skipped: number }> {
      const memories = this.readMemories(projectPath);
      let promoted = 0;
      let skipped = 0;

      for (const memory of memories) {
        const entry = this.toWikiEntry(memory);
        // Skip low-importance noise
        if (memory.importance < 0.3) {
          skipped++;
          continue;
        }
        await onMemory(entry);
        promoted++;
      }

      return { promoted, skipped };
    }
  };
}
