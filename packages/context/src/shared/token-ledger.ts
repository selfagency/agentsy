export interface TokenLedgerBudget {
  limit: number;
}

export interface TokenLedger {
  consume(tokens: number): boolean;
  remaining(): number;
}

export const createTokenLedger = ({ limit }: TokenLedgerBudget): TokenLedger => {
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
    }
  };
};
