/** Minimal structural interface matching AgentFsManager's shape — no import from @agentsy/memory. */
export interface AgentFsLike {
  read(path: string): { content: string; contentHash: string } | undefined;
  write(path: string, content: string): { contentHash: string };
  delete(path: string): boolean;
  list(): { path: string; contentHash: string }[];
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
  readonly entries: { path: string; contentHash: string }[];
}

export interface AgentFsAdapter {
  readonly name: "agentfs";
  read(input: AgentFsReadInput): AgentFsToolResult;
  write(input: AgentFsWriteInput): AgentFsToolResult;
  delete(input: AgentFsDeleteInput): AgentFsToolResult;
  list(): AgentFsListResult;
}

export function createAgentFsAdapter(manager: AgentFsLike): AgentFsAdapter {
  return {
    delete({ path }) {
      const deleted = manager.delete(path);
      if (!deleted) {
        return {
          error: `Path not found or already deleted: ${path}`,
          ok: false,
          path,
        };
      }
      return { ok: true, path };
    },

    list() {
      return { entries: manager.list(), ok: true };
    },

    name: "agentfs",

    read({ path }) {
      const entry = manager.read(path);
      if (entry === undefined) {
        return { error: `Path not found: ${path}`, ok: false, path };
      }
      return {
        content: entry.content,
        contentHash: entry.contentHash,
        ok: true,
        path,
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
          path,
        };
      }
    },
  };
}
