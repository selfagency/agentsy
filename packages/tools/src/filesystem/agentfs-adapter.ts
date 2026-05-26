/** Minimal structural interface matching AgentFsManager's shape — no import from @agentsy/memory. */
export interface AgentFsLike {
  delete(path: string): boolean;
  list(): { path: string; contentHash: string }[];
  read(path: string): { content: string; contentHash: string } | undefined;
  write(path: string, content: string): { contentHash: string };
}

export interface AgentFsToolResult {
  readonly content?: string;
  readonly contentHash?: string;
  readonly error?: string;
  readonly ok: boolean;
  readonly path: string;
}

export interface AgentFsReadInput {
  readonly path: string;
}

export interface AgentFsWriteInput {
  readonly content: string;
  readonly path: string;
}

export interface AgentFsDeleteInput {
  readonly path: string;
}

export interface AgentFsListResult {
  readonly entries: { path: string; contentHash: string }[];
  readonly ok: boolean;
}

export interface AgentFsAdapter {
  delete(input: AgentFsDeleteInput): AgentFsToolResult;
  list(): AgentFsListResult;
  readonly name: 'agentfs';
  read(input: AgentFsReadInput): AgentFsToolResult;
  write(input: AgentFsWriteInput): AgentFsToolResult;
}

export function createAgentFsAdapter(manager: AgentFsLike): AgentFsAdapter {
  return {
    delete({ path }) {
      const deleted = manager.delete(path);
      if (!deleted) {
        return {
          error: `Path not found or already deleted: ${path}`,
          ok: false,
          path
        };
      }
      return { ok: true, path };
    },

    list() {
      return { entries: manager.list(), ok: true };
    },

    name: 'agentfs',

    read({ path }) {
      const entry = manager.read(path);
      if (entry === undefined) {
        return { error: `Path not found: ${path}`, ok: false, path };
      }
      return {
        content: entry.content,
        contentHash: entry.contentHash,
        ok: true,
        path
      };
    },

    write({ path, content }) {
      try {
        const entry = manager.write(path, content);
        return { contentHash: entry.contentHash, ok: true, path };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
          ok: false,
          path
        };
      }
    }
  };
}
