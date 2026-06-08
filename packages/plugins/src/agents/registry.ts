/**
 * Agent registry — discovers and caches agent definitions via the loader.
 *
 * Provides a runtime view of all discoverable agents (built-in + filesystem).
 *
 * @module @agentsy/plugins/agents
 */

import { readdir } from 'node:fs/promises';
import { BUILTIN_AGENT_DEFINITIONS } from './builtins.js';
import type { AgentDefinition } from './definition.js';
import { AgentLoader } from './loader.js';

/**
 * Registry over an {@link AgentLoader} for agent discovery and lookup.
 *
 * Results are lazily resolved — every call to `list()` re-scans the
 * filesystem, so callers that need a stable snapshot should cache the
 * result themselves.
 */
export class AgentRegistry {
  readonly loader: AgentLoader;

  /** @param loader - The agent loader. Created with default project dir when omitted. */
  constructor(loader?: AgentLoader) {
    this.loader = loader ?? new AgentLoader();
  }

  /**
   * List all discoverable agent definitions.
   *
   * Returns bundled definitions merged with filesystem-discovered agents.
   * Filesystem definitions override bundled ones of the same id.
   *
   * @returns A promise resolving to an array of agent definitions.
   */
  // fallow-ignore-next-line complexity
  async list(): Promise<AgentDefinition[]> {
    const seen = new Set<string>();
    const result: AgentDefinition[] = [];

    // Start with bundled definitions as the baseline
    for (const def of BUILTIN_AGENT_DEFINITIONS) {
      result.push(def);
      seen.add(def.id);
    }

    // Search filesystem roots for additional definitions
    for (const root of this.loader.searchRoots) {
      try {
        const entries = await readdir(root);

        for (const entry of entries) {
          if (!entry.endsWith('.md')) {
            continue;
          }

          const agentId = entry.slice(0, -3); // strip '.md'

          try {
            const def = await this.loader.load(agentId);

            if (seen.has(agentId)) {
              // Override bundled entry
              const idx = result.findIndex(d => d.id === agentId);
              if (idx !== -1) {
                result[idx] = def;
              }
            } else {
              result.push(def);
              seen.add(agentId);
            }
          } catch {
            // Silently skip unparseable files
          }
        }
      } catch {
        // Root doesn't exist or is unreadable — skip
      }
    }

    return result;
  }

  /**
   * Get a single agent definition by id.
   *
   * Delegates to the loader's load method, which searches filesystem
   * roots before falling back to built-in definitions.
   *
   * @param agentId - The agent identifier to look up.
   * @returns The matching agent definition.
   * @throws When the agent cannot be found.
   */
  get(agentId: string): Promise<AgentDefinition> {
    return this.loader.load(agentId);
  }
}
