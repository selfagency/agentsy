// @agentsy/tokens — Token budgets, context reduction, and output shaping
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

export interface TokenBudget {
  limit: number;
}

export interface TokenLedger {
  consume(tokens: number): boolean;
  remaining(): number;
}

export const createTokenLedger = ({ limit }: TokenBudget): TokenLedger => {
  let consumed = 0;

  return {
    consume(tokens) {
      if (tokens < 0) {
        return false;
      }

      if (consumed + tokens > limit) {
        return false;
      }

      consumed += tokens;
      return true;
    },
    remaining() {
      return Math.max(0, limit - consumed);
    },
  };
};
