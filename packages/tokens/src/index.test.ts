import { describe, expect, it } from 'vitest';
import { createTokenLedger } from './index.js';

describe('createTokenLedger', () => {
  it('consumes tokens within budget', () => {
    const ledger = createTokenLedger({ limit: 10 });

    expect(ledger.consume(4)).toBe(true);
    expect(ledger.remaining()).toBe(6);
  });

  it('rejects negative and over-budget token usage', () => {
    const ledger = createTokenLedger({ limit: 5 });

    expect(ledger.consume(-1)).toBe(false);
    expect(ledger.consume(6)).toBe(false);
    expect(ledger.remaining()).toBe(5);
  });
});
