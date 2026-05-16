import type { AgentFsEntry, AgentFsManager, AgentFsOptions } from '@agentsy/types';
import { createHash } from 'node:crypto';

export type { AgentFsEntry, AgentFsManager, AgentFsOptions };

// SHA-256 is used for legacy compatibility; PHASE 4 implementation switched to BLAKE3/SHA-256
// but we'll stick to a stable hash function for now as documented in types.
function hashContent(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

/** @internal */
export const __globalStoreForTests = new Map<string, Map<string, AgentFsEntry>>();
const globalStore = __globalStoreForTests;

export function createAgentFsManager(options?: AgentFsOptions): AgentFsManager {
  const namespaceLabel = options?.namespace ?? 'default';

  if (!globalStore.has(namespaceLabel)) {
    globalStore.set(namespaceLabel, new Map<string, AgentFsEntry>());
  }

  const store = globalStore.get(namespaceLabel);
  if (!store) {
    throw new Error(`Failed to initialize store for namespace: ${namespaceLabel}`);
  }

  return {
    get namespace() {
      return namespaceLabel;
    },

    read(path: string) {
      return store.get(path);
    },

    write(path: string, content: string) {
      const now = Date.now();
      const existing = store.get(path);
      const entry: AgentFsEntry = {
        path,
        content,
        contentHash: hashContent(content),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      store.set(path, entry);
      return entry;
    },

    delete(path: string) {
      return store.delete(path);
    },

    list() {
      return [...store.values()];
    },

    has(path: string) {
      return store.has(path);
    },

    clear() {
      store.clear();
    },

    import(entries: AgentFsEntry[]) {
      for (const entry of entries) {
        store.set(entry.path, entry);
      }
    }
  };
}
