/**
 * Statistics for LLM stream processing.
 * Tracks buffer usage, chunk counts, and performance metrics
 * to enable production observability.
 */

export interface ProcessorStats {
  /** Total number of chunks processed */
  chunksProcessed: number;

  /** Total bytes processed across all chunks */
  bytesProcessed: number;

  /** Current buffer size in bytes */
  currentBufferSize: number;

  /** Peak buffer size observed so far */
  peakBufferSize: number;

  /** Average chunk size in bytes */
  averageChunkSize: number;

  /** Total time spent in parse operations (milliseconds) */
  parseTimeMs: number;

  /** Number of thinking blocks extracted */
  thinkingBlocksCount: number;

  /** Number of tool calls extracted */
  toolCallsCount: number;

  /** Number of content deltas emitted */
  contentDeltasCount: number;

  /** Number of errors encountered during processing */
  errorsCount: number;

  /** Number of warnings emitted during processing */
  warningsCount: number;

  /** Timestamp when stats were last reset */
  resetAt: Date;

  /** Timestamp of first chunk processed */
  firstChunkAt?: Date;

  /** Timestamp of last chunk processed */
  lastChunkAt?: Date;
}

/**
 * Create an empty ProcessorStats object.
 * All counters initialized to zero, timestamps to current time.
 */
export function createEmptyStats(): ProcessorStats {
  const now = new Date();
  return {
    averageChunkSize: 0,
    bytesProcessed: 0,
    chunksProcessed: 0,
    contentDeltasCount: 0,
    currentBufferSize: 0,
    errorsCount: 0,
    parseTimeMs: 0,
    peakBufferSize: 0,
    resetAt: now,
    thinkingBlocksCount: 0,
    toolCallsCount: 0,
    warningsCount: 0,
  };
}
