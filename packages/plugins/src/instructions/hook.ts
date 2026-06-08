/**
 * Instructions hook factory — creates a `beforeInit` callback that merges
 * discovered instruction files into the agent loop options.
 *
 * @module @agentsy/plugins/instructions
 */

// fallow-ignore-file unused-file
import type { InstructionsDiscoverer } from './discoverer.js';
import type { InstructionFile } from './types.js';

/**
 * Options for the instructions hook.
 */
export interface InstructionsHookOptions {
  /** Optional override for the instruction set to inject. */
  instructions?: InstructionFile[];
}

/**
 * Result of the instructions hook execution.
 */
export interface InstructionsHookResult {
  /** All discovered instruction files (with metadata). */
  readonly discoveredFiles: readonly InstructionFile[];
  /** Merged instruction content strings in priority order. */
  readonly mergedInstructions: string[];
  /** Total number of unique instruction sources found. */
  readonly sourceCount: number;
}

/**
 * Create a `beforeInit` callback that discovers and merges instruction files.
 *
 * The returned function can be wired as an agent loop hook to inject
 * system-level instructions before agent initialisation.
 *
 * @param discoverer - Configured {@link InstructionsDiscoverer} instance.
 * @param options - Optional overrides.
 * @returns A hook function that returns the merged instruction result.
 */
export function createInstructionsHook(
  discoverer: InstructionsDiscoverer,
  options?: InstructionsHookOptions
): () => Promise<InstructionsHookResult> {
  // fallow-ignore-next-line complexity
  return async (): Promise<InstructionsHookResult> => {
    const files = options?.instructions ?? (await discoverer.discover());

    // Collect unique content strings in priority order (already sorted).
    const seen = new Set<string>();
    const mergedInstructions: string[] = [];

    for (const file of files) {
      if (!seen.has(file.content)) {
        seen.add(file.content);
        mergedInstructions.push(file.content);
      }
    }

    return {
      mergedInstructions,
      discoveredFiles: files,
      sourceCount: files.length
    };
  };
}
