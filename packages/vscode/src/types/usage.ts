import type { IQuotaDataSource, UsageQuota } from './errors.js';

/**
 * Usage tracking events.
 */
export type UsageEvent = 'quota_updated' | 'threshold_reached' | 'limit_exceeded';

/**
 * Usage event listener.
 */
export type UsageEventListener = (
  event: UsageEvent,
  quota: UsageQuota,
) => void;

/**
 * Re-export for convenience.
 */
export type { IQuotaDataSource, UsageQuota };
