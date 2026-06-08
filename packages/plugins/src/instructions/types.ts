/**
 * Instruction file types — paths and metadata for instruction sources.
 *
 * @module @agentsy/plugins/instructions
 */

/**
 * Describes a discovered instruction file with merge/precedence metadata.
 */
export interface InstructionFile {
  /** Whether the file content should always be injected (never skipped). */
  readonly alwaysInject: boolean;

  /**
   * Optional glob pattern restricting which files or modules this
   * instruction file applies to.
   *
   * When omitted, the instruction applies globally.
   */
  readonly applyTo?: string;

  /** Raw file content as read from disk. */
  readonly content: string;
  /** Absolute path to the instruction file on disk. */
  readonly path: string;

  /**
   * Precedence weight (0–100).
   *
   * Higher values indicate higher priority. When merging multiple
   * instruction files, those with a higher priority take precedence
   * over lower-priority ones.
   */
  readonly priority: number;

  /**
   * Optional scope label used for merge/precedence logic.
   *
   * When omitted, the file is treated as project-scoped.
   */
  readonly scope?: 'workspace' | 'user' | 'bundled';
}
