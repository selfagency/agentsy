/**
 * Token budget tracking and enforcement for agent context windows.
 *
 * Provides typed budget caps per category (input, output, context, turn, session)
 * with strict enforcement, usage warnings at configurable thresholds, and
 * resettable counters for session/turn boundaries.
 *
 * @module @agentsy/context/budget
 */

/**
 * Token budget caps for an agent context window.
 *
 * All caps are in token counts. Optional caps (`perTurnCap`, `perSessionCap`)
 * are omitted when unbounded.
 */
export interface TokenBudget {
  /** Max total context window tokens */
  readonly contextCap: number;
  /** Max input (prompt) tokens per turn */
  readonly inputCap: number;
  /** Max output (completion) tokens per turn */
  readonly outputCap: number;
  /** Optional per-session total cap spanning multiple turns */
  readonly perSessionCap?: number;
  /** Optional per-turn total cap (input + output combined) */
  readonly perTurnCap?: number;
}

/**
 * Budget categories that map to `TokenBudget` fields.
 */
export type BudgetCategory = 'input' | 'output' | 'context' | 'turn' | 'session';

/**
 * Thrown by {@link BudgetEnforcer.recordUsage} when a consumption request
 * exceeds the remaining budget for a category.
 */

/** @internal Assert exhaustiveness — never reached at runtime. */
function assertUnreachable(_value: never): void {
  // noop
}
export class BudgetExceededError extends Error {
  readonly budgetCategory: BudgetCategory;
  readonly requested: number;
  readonly available: number;

  constructor(budgetCategory: BudgetCategory, requested: number, available: number) {
    super(`Budget "${budgetCategory}" exceeded: requested ${requested}, available ${available}`);
    this.name = 'BudgetExceededError';
    this.budgetCategory = budgetCategory;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Warning emitted when a budget threshold is crossed.
 */
export interface BudgetWarning {
  readonly cap: number;
  readonly category: BudgetCategory;
  readonly message: string;
  readonly percentage: number;
  readonly usage: number;
}

// Default yellow-warning threshold: 80% of the cap.
const YELLOW_THRESHOLD = 0.8;

/**
 * Enforces token budget limits per category with consumption tracking,
 * pre-flight checks, and threshold warnings.
 *
 * Use `canAccommodate` for pre-flight checks before spending tokens,
 * `recordUsage` to commit consumption (throws on overage), and `remaining`
 * to query available headroom. Call `reset` at session or turn boundaries.
 */
export class BudgetEnforcer {
  readonly #budget: TokenBudget;
  #inputUsed = 0;
  #outputUsed = 0;
  #contextUsed = 0;
  #turnUsed = 0;
  #sessionUsed = 0;
  readonly #warnings: BudgetWarning[] = [];

  constructor(budget: TokenBudget) {
    this.#budget = budget;
  }

  /**
   * Check whether `tokens` can be accommodated in `category` without
   * exceeding the cap.
   *
   * Returns `true` when the category has no cap.
   */
  canAccommodate(category: BudgetCategory, tokens: number): boolean {
    if (!Number.isFinite(tokens) || tokens < 0) {
      return false;
    }

    const cap = this.#capFor(category);
    if (cap === undefined) {
      return true;
    }

    return this.#usedFor(category) + tokens <= cap;
  }

  /**
   * Record consumption of `tokens` in `category`.
   *
   * Throws {@link BudgetExceededError} when consumption would exceed the
   * category's cap. Emits a {@link BudgetWarning} into `warnings` when the
   * output category crosses the yellow warning threshold (80%).
   */
  recordUsage(category: BudgetCategory, tokens: number): void {
    if (tokens < 0) {
      throw new Error(`Cannot record negative token usage: ${tokens}`);
    }
    if (!Number.isFinite(tokens)) {
      throw new TypeError(`Invalid token count: ${tokens}`);
    }

    const cap = this.#capFor(category);

    if (cap !== undefined) {
      const used = this.#usedFor(category);
      const newTotal = used + tokens;

      if (newTotal > cap) {
        throw new BudgetExceededError(category, tokens, cap - used);
      }

      // Yellow warning when output crosses 80% threshold
      if (category === 'output') {
        const ratio = newTotal / cap;
        if (ratio >= YELLOW_THRESHOLD) {
          // Only emit once per crossing (first time usage crosses the threshold)
          const wasBelowThreshold = used / cap < YELLOW_THRESHOLD;
          if (wasBelowThreshold) {
            this.#warnings.push({
              category,
              message: `Output budget at ${Math.round(ratio * 100)}% (warning threshold: ${YELLOW_THRESHOLD * 100}%)`,
              usage: newTotal,
              cap,
              percentage: Math.round(ratio * 100)
            });
          }
        }
      }
    }

    this.#addUsage(category, tokens);
  }

  /**
   * Remaining tokens available in `category`.
   *
   * Returns `Infinity` when the category has no cap.
   */
  remaining(category: BudgetCategory): number {
    const cap = this.#capFor(category);
    if (cap === undefined) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, cap - this.#usedFor(category));
  }

  /**
   * Reset usage counters.
   *
   * When `category` is provided, only that category is reset. Otherwise
   * all counters and warnings are cleared.
   */
  reset(category?: BudgetCategory): void {
    if (category) {
      this.#setUsed(category, 0);
    } else {
      this.#inputUsed = 0;
      this.#outputUsed = 0;
      this.#contextUsed = 0;
      this.#turnUsed = 0;
      this.#sessionUsed = 0;
      this.#warnings.length = 0;
    }
  }

  /**
   * Accumulated budget warnings (read-only).
   */
  get warnings(): readonly BudgetWarning[] {
    return this.#warnings;
  }

  // --- internal helpers ---

  #capFor(category: BudgetCategory): number | undefined {
    switch (category) {
      case 'input':
        return this.#budget.inputCap;
      case 'output':
        return this.#budget.outputCap;
      case 'context':
        return this.#budget.contextCap;
      case 'turn':
        return this.#budget.perTurnCap;
      case 'session':
        return this.#budget.perSessionCap;
      default:
        assertUnreachable(category);
        return;
    }
  }

  #usedFor(category: BudgetCategory): number {
    switch (category) {
      case 'input':
        return this.#inputUsed;
      case 'output':
        return this.#outputUsed;
      case 'context':
        return this.#contextUsed;
      case 'turn':
        return this.#turnUsed;
      case 'session':
        return this.#sessionUsed;
      default:
        assertUnreachable(category);
        return 0;
    }
  }

  #addUsage(category: BudgetCategory, tokens: number): void {
    switch (category) {
      case 'input':
        this.#inputUsed += tokens;
        break;
      case 'output':
        this.#outputUsed += tokens;
        break;
      case 'context':
        this.#contextUsed += tokens;
        break;
      case 'turn':
        this.#turnUsed += tokens;
        break;
      case 'session':
        this.#sessionUsed += tokens;
        break;
      default:
        assertUnreachable(category);
    }
  }

  #setUsed(category: BudgetCategory, value: number): void {
    switch (category) {
      case 'input':
        this.#inputUsed = value;
        break;
      case 'output':
        this.#outputUsed = value;
        break;
      case 'context':
        this.#contextUsed = value;
        break;
      case 'turn':
        this.#turnUsed = value;
        break;
      case 'session':
        this.#sessionUsed = value;
        break;
      default:
        assertUnreachable(category);
    }
  }
}
