/**
 * Instruction layer types and composer for @agentsy/prompts.
 *
 * Defines the {@link InstructionsLayer} segment type used in prompt pipeline
 * assembly and the {@link InstructionsComposer} that performs deterministic
 * priority-sorted merging of instruction files.
 *
 * @module @agentsy/prompts/layers/instructions
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A loaded instruction file ready for composition.
 */
export interface InstructionFile {
  /** Raw instruction content. */
  readonly content: string;
  /** Filesystem or logical path the instruction was loaded from. */
  readonly path: string;
  /** Priority rank — higher values appear earlier in the composed output. */
  readonly priority: number;
  /** Optional scope qualifier (e.g. `"agent"`, `"global"`, `"project"`). */
  readonly scope?: string;
  /** Pre-computed token count of {@link content}. */
  readonly tokenCount: number;
}

/**
 * A composed instruction segment ready for prompt assembly.
 */
export interface InstructionsLayer {
  /** Merged instruction content, sorted by priority descending. */
  readonly content: string;
  /** Highest priority among the merged instructions (0 if none). */
  readonly priority: number;
  /** Total token count — sum of all constituent instruction token counts. */
  readonly tokenCount: number;
  /** Discriminant for layer-type routing. */
  readonly type: 'instructions';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estimate token count from raw text using a 4:1 character-to-token ratio.
 *
 * This is intentionally a simple heuristic.  Consumers that need exact counts
 * should pre-compute an accurate {@link InstructionFile.tokenCount} before
 * passing the file to the composer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

/**
 * Deterministic instruction composer.
 *
 * Accepts a list of {@link InstructionFile} instances and produces a single
 * {@link InstructionsLayer} by sorting entries by priority (highest first),
 * concatenating their content with double-newline separators, and summing
 * their token counts.
 */
export class InstructionsComposer {
  /**
   * Compose instruction files into a single layer.
   *
   * @param instructions - Instruction files to compose.  The array is not
   *   mutated — sorting is performed on a defensive copy.
   * @returns A fully populated {@link InstructionsLayer}.
   */
  compose(instructions: readonly InstructionFile[]): InstructionsLayer {
    if (instructions.length === 0) {
      return {
        type: 'instructions',
        content: '',
        tokenCount: 0,
        priority: 0
      };
    }

    // Sort descending by priority (defensive copy).
    const sorted = [...instructions].sort((a, b) => b.priority - a.priority);

    return {
      type: 'instructions',
      content: sorted.map(inst => inst.content).join('\n\n'),
      tokenCount: sorted.reduce((sum, inst) => sum + inst.tokenCount, 0),
      priority: sorted[0]?.priority ?? 0
    };
  }
}
