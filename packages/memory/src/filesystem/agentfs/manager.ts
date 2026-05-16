import type { AgentFsEntry, AgentFsManager, AgentFsOptions, AgentFsPath } from '@agentsy/types';
import { createHash } from 'node:crypto';

export type { AgentFsEntry, AgentFsManager, AgentFsOptions, AgentFsPath };

function hashContent(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function createAgentFsManager(options?: AgentFsOptions): AgentFsManager {
  const namespace = options?.namespace ?? 'default';
  const store = new Map<AgentFsPath, AgentFsEntry>();

  return {
    get namespace() {
      return namespace;
    },

    read(path: AgentFsPath) {
      return store.get(path);
    },

    write(path: AgentFsPath, content: string) {
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

    delete(path: AgentFsPath) {
      return store.delete(path);
    },

    list() {
      return [...store.values()];
    },

    has(path: AgentFsPath) {
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
