/**
 * Token usage and budget tracking types.
 */

/**
 * Token usage breakdown.
 */
export interface TokenUsage {
  /** Input/prompt tokens consumed. */
  prompt: number;

  /** Output/completion tokens consumed. */
  completion: number;

  /** Total tokens used. */
  total: number;
}

/**
 * Token budget with limits and tracking.
 */
export interface TokenBudget {
  /** Maximum budget in tokens. */
  limit: number;

  /** Current usage against budget. */
  used: number;

  /** Remaining budget. */
  remaining: number;

  /** Percentage of budget used. */
  percentUsed: number;
}

/**
 * Ledger entry for token consumption.
 */
export interface TokenLedger {
  /** Identifier for the tracked resource/agent. */
  id: string;

  /** Total tokens consumed. */
  totalTokens: number;

  /** Prompt tokens consumed. */
  promptTokens: number;

  /** Completion tokens consumed. */
  completionTokens: number;

  /** Current budget status. */
  budget: TokenBudget;

  /** Ledger entries by timestamp. */
  entries: {
    timestamp: number;
    prompt: number;
    completion: number;
    context?: string;
  }[];
}