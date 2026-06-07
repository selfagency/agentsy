import { describe, expect, it } from 'vitest';

import type { HeaderSnapshotInput } from './quota-reconciliation.js';
import { reconcileQuotaConfidence } from './quota-reconciliation.js';

const testHeader: HeaderSnapshotInput = {
  rpmLimit: 100,
  rpmRemaining: 80,
  rpmResetSeconds: 30,
  tpmLimit: 200_000,
  tpmRemaining: 150_000,
  tpmResetSeconds: 60
};

describe('reconcileQuotaConfidence', () => {
  it('uses header data when only header is available', () => {
    const result = reconcileQuotaConfidence(testHeader, null);
    expect(result.confidence).toBe('header-derived');
    expect(result.effectiveRpmRemaining).toBe(80);
    expect(result.effectiveTpmRemaining).toBe(150_000);
    expect(result.rpmLimit).toBe(100);
    expect(result.tpmLimit).toBe(200_000);
    expect(result.header).toBe(testHeader);
    expect(result.tokenomics).toBeNull();
  });

  it('uses tokenomics data when only tokenomics is available', () => {
    const result = reconcileQuotaConfidence(null, {
      replicaId: 'test',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test',
      remainingTokensMinute: 3000,
      remainingRequestsMinute: 50,
      lastUpdatedAt: new Date().toISOString(),
      confidence: 'tokenomics-derived'
    });

    expect(result.confidence).toBe('tokenomics-derived');
    expect(result.effectiveRpmRemaining).toBe(50);
    expect(result.effectiveTpmRemaining).toBe(3000);
    expect(result.header).toBeNull();
    expect(result.tokenomics).not.toBeNull();
  });

  it('picks the more conservative value when both sources available', () => {
    const result = reconcileQuotaConfidence(testHeader, {
      replicaId: 'test',
      logicalModelId: 'gpt-4o-mini',
      providerId: 'test',
      remainingTokensMinute: 200_000,
      remainingRequestsMinute: 100,
      lastUpdatedAt: new Date().toISOString(),
      confidence: 'tokenomics-derived'
    });

    // header has 80 RPM / 150k TPM; tokenomics has 100 RPM / 200k TPM
    // conservative = min = 80 RPM, 150k TPM
    expect(result.confidence).toBe('header-derived');
    expect(result.effectiveRpmRemaining).toBe(80);
    expect(result.effectiveTpmRemaining).toBe(150_000);
  });

  it('returns estimated confidence when neither source is available', () => {
    const result = reconcileQuotaConfidence(null, null);
    expect(result.confidence).toBe('estimated');
    expect(result.effectiveRpmRemaining).toBe(0);
    expect(result.effectiveTpmRemaining).toBe(0);
    expect(result.header).toBeNull();
    expect(result.tokenomics).toBeNull();
  });

  it('includes ISO timestamp in reconciledAt', () => {
    const result = reconcileQuotaConfidence(null, null);
    const parsed = new Date(result.reconciledAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
