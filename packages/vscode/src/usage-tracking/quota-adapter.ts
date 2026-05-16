import type { IQuotaDataSource, UsageQuota } from "../types/errors.js";

export type QuotaWindow = UsageQuota["window"];

export interface QuotaWindowValue {
  used: number;
  total: number;
  window: QuotaWindow;
  unit: UsageQuota["unit"];
  expiresAt?: Date;
}

export type ActiveQuotaWindowStrategy =
  | "most-constrained"
  | "highest-percent"
  | "preferred-order";

export interface QuotaAdapterOptions<TPayload> {
  fetch: () => Promise<TPayload>;
  mapWindows: (payload: TPayload) => QuotaWindowValue[];
  strategy?: ActiveQuotaWindowStrategy;
  preferredOrder?: QuotaWindow[];
}

const DEFAULT_WINDOW_ORDER: QuotaWindow[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
];
const EMPTY_QUOTA_WINDOW: QuotaWindowValue = {
  total: 1,
  unit: "requests",
  used: 0,
  window: "daily",
};

function percentUsed(windowValue: QuotaWindowValue): number {
  if (windowValue.total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, windowValue.used / windowValue.total));
}

/** Select the active quota window from multiple windows. */
export function pickActiveQuotaWindow(
  windows: QuotaWindowValue[],
  strategy: ActiveQuotaWindowStrategy = "most-constrained",
  preferredOrder: QuotaWindow[] = DEFAULT_WINDOW_ORDER
): QuotaWindowValue {
  if (windows.length === 0) {
    return { ...EMPTY_QUOTA_WINDOW };
  }

  if (strategy === "preferred-order") {
    for (const window of preferredOrder) {
      const match = windows.find((value) => value.window === window);
      if (match !== undefined) {
        return match;
      }
    }
    const first = windows[0];
    if (first !== undefined) {
      return first;
    }
    return { ...EMPTY_QUOTA_WINDOW };
  }

  if (strategy === "highest-percent") {
    const [first, ...rest] = windows;
    if (first === undefined) {
      return { ...EMPTY_QUOTA_WINDOW };
    }

    return rest.reduce(
      (best, current) =>
        percentUsed(current) > percentUsed(best) ? current : best,
      first
    );
  }

  // most-constrained: prefer highest percent, then lower absolute remaining budget.
  const [first, ...rest] = windows;
  if (first === undefined) {
    return { ...EMPTY_QUOTA_WINDOW };
  }

  return rest.reduce((best, current) => {
    const bestPercent = percentUsed(best);
    const currentPercent = percentUsed(current);
    if (currentPercent > bestPercent) {
      return current;
    }
    if (currentPercent < bestPercent) {
      return best;
    }

    const bestRemaining = best.total - best.used;
    const currentRemaining = current.total - current.used;
    return currentRemaining < bestRemaining ? current : best;
  }, first);
}

/** Format a standard quota tooltip across integrations. */
export function formatStandardQuotaTooltip(
  displayName: string,
  quota: UsageQuota
): string {
  const percent = Math.round(quota.percentUsed * 100);
  const base = `${displayName}: ${quota.used.toLocaleString()} / ${quota.total.toLocaleString()} ${quota.unit} (${percent}%)`;
  if (quota.expiresAt === undefined) {
    return `${base} • ${quota.window}`;
  }
  return `${base} • ${quota.window} • resets ${quota.expiresAt.toLocaleString()}`;
}

/**
 * Creates an IQuotaDataSource from provider-specific payloads with multiple quota windows.
 */
export function createQuotaDataSourceAdapter<TPayload>(
  options: QuotaAdapterOptions<TPayload>
): IQuotaDataSource {
  const strategy = options.strategy ?? "most-constrained";
  const preferredOrder = options.preferredOrder ?? DEFAULT_WINDOW_ORDER;

  function normalize(payload: TPayload): UsageQuota {
    const windows = options.mapWindows(payload);
    const active = pickActiveQuotaWindow(windows, strategy, preferredOrder);
    const percent = percentUsed(active);
    return {
      percentUsed: percent,
      total: active.total,
      unit: active.unit,
      used: active.used,
      window: active.window,
      ...(active.expiresAt === undefined
        ? {}
        : { expiresAt: active.expiresAt }),
    };
  }

  return {
    async getQuota(): Promise<UsageQuota> {
      const payload = await options.fetch();
      return normalize(payload);
    },
    async refreshQuota(): Promise<UsageQuota> {
      const payload = await options.fetch();
      return normalize(payload);
    },
  };
}
