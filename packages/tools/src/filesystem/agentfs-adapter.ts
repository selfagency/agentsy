/** Minimal structural interface matching AgentFsManager's shape — no import from @agentsy/memory. */
export interface AgentFsLike {
  read(path: string): { content: string; contentHash: string } | undefined;
  write(path: string, content: string): { contentHash: string };
  delete(path: string): boolean;
  list(): Array<{ path: string; contentHash: string }>;
}

export interface AgentFsToolResult {
  readonly ok: boolean;
  readonly path: string;
  readonly content?: string;
  readonly contentHash?: string;
  readonly error?: string;
}

export interface AgentFsReadInput {
  readonly path: string;
}

export interface AgentFsWriteInput {
  readonly path: string;
  readonly content: string;
}

export interface AgentFsDeleteInput {
  readonly path: string;
}

export interface AgentFsListResult {
  readonly ok: boolean;
  readonly entries: Array<{ path: string; contentHash: string }>;
}

export interface AgentFsAdapter {
  readonly name: 'agentfs';
  read(input: AgentFsReadInput): AgentFsToolResult;
  write(input: AgentFsWriteInput): AgentFsToolResult;
  delete(input: AgentFsDeleteInput): AgentFsToolResult;
  list(): AgentFsListResult;
}

export function createAgentFsAdapter(manager: AgentFsLike): AgentFsAdapter {
  return {
    name: 'agentfs',

    read({ path }) {
      const entry = manager.read(path);
      if (entry === undefined) {
        return { ok: false, path, error: `Path not found: ${path}` };
      }
      return { ok: true, path, content: entry.content, contentHash: entry.contentHash };
    },

    write({ path, content }) {
      try {
        const entry = manager.write(path, content);
        return { ok: true, path, contentHash: entry.contentHash };
      } catch (err) {
        return { ok: false, path, error: err instanceof Error ? err.message : String(err) };
      }
    },

    delete({ path }) {
      const deleted = manager.delete(path);
      if (!deleted) {
        return { ok: false, path, error: `Path not found or already deleted: ${path}` };
      }
      return { ok: true, path };
    },

    list() {
      return { ok: true, entries: manager.list() };
    }
  };
}
