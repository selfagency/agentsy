import { createHash } from 'node:crypto';

export type AgentFsPath = string;

export interface AgentFsEntry {
  readonly path: AgentFsPath;
  readonly content: string;
  readonly contentHash: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface AgentFsOptions {
  readonly namespace?: string;
}

export interface AgentFsManager {
  readonly namespace: string;
  read(path: AgentFsPath): AgentFsEntry | undefined;
  write(path: AgentFsPath, content: string): AgentFsEntry;
  delete(path: AgentFsPath): boolean;
  list(): AgentFsEntry[];
  has(path: AgentFsPath): boolean;
  clear(): void;
}

function hashContent(content: string): string {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createAgentFsManager(options?: AgentFsOptions): AgentFsManager {
  const namespace = options?.namespace ?? 'default';
  const store = new Map<AgentFsPath, AgentFsEntry>();

  return {
    get namespace() {
      return namespace;
    },

    read(path) {
      return store.get(path);
    },

    write(path, content) {
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

    delete(path) {
      return store.delete(path);
    },

    list() {
      return [...store.values()];
    },

    has(path) {
      return store.has(path);
    },

    clear() {
      store.clear();
    }
  };
}
