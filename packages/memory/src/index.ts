// @agentsy/memory — Three-layer memory engine (raw event log, synthesized wiki, vector retrieval)
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

export interface MemoryRecord {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStore {
  put(record: MemoryRecord): void;
  get(id: string): MemoryRecord | undefined;
  list(): MemoryRecord[];
}

export const createMemoryStore = (): MemoryStore => {
  const records = new Map<string, MemoryRecord>();

  return {
    put(record) {
      records.set(record.id, record);
    },
    get(id) {
      return records.get(id);
    },
    list() {
      return [...records.values()];
    },
  };
};
