import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IQuotaDataSource, UsageQuota } from '../types/errors.js';
import { mapUsageToVSCode } from './map-usage.js';
import {
  createQuotaDataSourceAdapter,
  formatStandardQuotaTooltip,
  pickActiveQuotaWindow,
  type QuotaWindowValue,
} from './quota-adapter.js';
import { UsageStatusBar, formatQuotaText, getQuotaStatus } from './usage-status-bar.js';

function makeQuota(overrides: Partial<UsageQuota> = {}): UsageQuota {
  return {
    used: 5000,
    total: 10000,
    unit: 'tokens',
    window: 'daily',
    percentUsed: 0.5,
    ...overrides,
  };
}

function makeDataSource(quota: UsageQuota = makeQuota()): IQuotaDataSource & { quota: UsageQuota } {
  return {
    quota,
    getQuota: vi.fn().mockResolvedValue(quota),
    refreshQuota: vi.fn().mockResolvedValue(quota),
    dispose: vi.fn(),
  };
}

describe('formatQuotaText', () => {
  it('formats token quota', () => {
    const text = formatQuotaText(makeQuota({ used: 1000, total: 5000, unit: 'tokens', percentUsed: 0.2 }));
    expect(text).toBe('1,000 / 5,000 tokens (20%)');
  });

  it('rounds percentage', () => {
    const text = formatQuotaText(makeQuota({ used: 1, total: 3, unit: 'credits', percentUsed: 1 / 3 }));
    expect(text).toContain('33%');
  });
});

describe('getQuotaStatus', () => {
  it('returns normal below warning threshold', () => {
    expect(getQuotaStatus(0.5)).toBe('normal');
  });

  it('returns warning at warning threshold', () => {
    expect(getQuotaStatus(0.8)).toBe('warning');
  });

  it('returns warning between thresholds', () => {
    expect(getQuotaStatus(0.9)).toBe('warning');
  });

  it('returns error at error threshold', () => {
    expect(getQuotaStatus(0.95)).toBe('error');
  });

  it('returns error above error threshold', () => {
    expect(getQuotaStatus(0.99)).toBe('error');
  });

  it('uses custom thresholds', () => {
    expect(getQuotaStatus(0.5, 0.4, 0.6)).toBe('warning');
    expect(getQuotaStatus(0.7, 0.4, 0.6)).toBe('error');
    expect(getQuotaStatus(0.3, 0.4, 0.6)).toBe('normal');
  });
});

describe('UsageStatusBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('show is a no-op when VS Code unavailable', async () => {
    const ds = makeDataSource();
    const bar = new UsageStatusBar({
      displayName: 'Test Usage',
      quotaDataSource: ds,
    });
    await expect(bar.show()).resolves.not.toThrow();
    bar.dispose();
  });

  it('refresh returns quota from data source', async () => {
    const quota = makeQuota({ used: 3000, percentUsed: 0.3 });
    const ds = makeDataSource(quota);
    const bar = new UsageStatusBar({
      displayName: 'Test Usage',
      quotaDataSource: ds,
    });
    const result = await bar.refresh();
    expect(ds.refreshQuota).toHaveBeenCalledOnce();
    expect(result?.used).toBe(3000);
    bar.dispose();
  });

  it('refresh returns undefined on data source error', async () => {
    const ds: IQuotaDataSource = {
      getQuota: vi.fn().mockRejectedValue(new Error('API down')),
      refreshQuota: vi.fn().mockRejectedValue(new Error('API down')),
    };
    const bar = new UsageStatusBar({
      displayName: 'Test Usage',
      quotaDataSource: ds,
    });
    const result = await bar.refresh();
    expect(result).toBeUndefined();
    bar.dispose();
  });

  it('updateDisplay is a no-op without statusBarItem', () => {
    const ds = makeDataSource();
    const bar = new UsageStatusBar({ displayName: 'Test Usage', quotaDataSource: ds });
    expect(() => bar.updateDisplay(makeQuota())).not.toThrow();
    bar.dispose();
  });

  it('dispose calls quotaDataSource.dispose', () => {
    const ds = makeDataSource();
    const bar = new UsageStatusBar({ displayName: 'Test Usage', quotaDataSource: ds });
    bar.dispose();
    expect(ds.dispose).toHaveBeenCalledOnce();
  });

  it('dispose without quotaDataSource.dispose does not throw', () => {
    const ds: IQuotaDataSource = {
      getQuota: vi.fn().mockResolvedValue(makeQuota()),
      refreshQuota: vi.fn().mockResolvedValue(makeQuota()),
    };
    const bar = new UsageStatusBar({ displayName: 'Test Usage', quotaDataSource: ds });
    expect(() => bar.dispose()).not.toThrow();
  });

  it('hide is a no-op without statusBarItem', () => {
    const ds = makeDataSource();
    const bar = new UsageStatusBar({ displayName: 'Test Usage', quotaDataSource: ds });
    expect(() => bar.hide()).not.toThrow();
    bar.dispose();
  });
});

describe('Quota adapter utilities', () => {
  it('pickActiveQuotaWindow prefers most constrained window by default', () => {
    const windows: QuotaWindowValue[] = [
      { used: 50, total: 100, unit: 'tokens', window: 'hourly' },
      { used: 900, total: 1000, unit: 'tokens', window: 'daily' },
    ];

    const active = pickActiveQuotaWindow(windows);
    expect(active.window).toBe('daily');
  });

  it('createQuotaDataSourceAdapter maps multi-window payloads', async () => {
    const source = createQuotaDataSourceAdapter({
      fetch: async () => ({
        windows: [
          { used: 20, total: 100, unit: 'tokens' as const, window: 'hourly' as const },
          { used: 850, total: 1000, unit: 'tokens' as const, window: 'monthly' as const },
        ],
      }),
      mapWindows: payload => payload.windows,
      strategy: 'highest-percent',
    });

    const quota = await source.getQuota();
    expect(quota.window).toBe('monthly');
    expect(quota.percentUsed).toBe(0.85);
  });

  it('formatStandardQuotaTooltip formats consistent tooltip text', () => {
    const tooltip = formatStandardQuotaTooltip('Z.ai Usage', {
      used: 800,
      total: 1000,
      unit: 'tokens',
      window: 'weekly',
      percentUsed: 0.8,
    });

    expect(tooltip).toContain('Z.ai Usage: 800 / 1,000 tokens (80%)');
    expect(tooltip).toContain('weekly');
  });
});

describe('mapUsageToVSCode', () => {
  it('maps input/output tokens to prompt/completion tokens', () => {
    const mapped = mapUsageToVSCode({ inputTokens: 11, outputTokens: 22 });
    expect(mapped).toEqual({ promptTokens: 11, completionTokens: 22 });
  });

  it('returns undefined for undefined usage', () => {
    expect(mapUsageToVSCode(undefined)).toBeUndefined();
  });
});
