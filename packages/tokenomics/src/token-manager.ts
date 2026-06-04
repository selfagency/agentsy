import { randomUUID } from 'node:crypto';

export interface TokenLedgerBudget {
  limit: number;
}

export interface TokenLedger {
  consume(tokens: number): boolean;
  remaining(): number;
}

export type BudgetResetStrategy = 'fixed' | 'rolling' | 'manual';
export type BudgetPriority = 'high' | 'medium' | 'low';
export type RequestType = 'completion' | 'embedding' | 'fine-tuning';

export interface TokenBudget {
  id: string;
  maxCost: number;
  maxTokens: number;
  metadata?: Record<string, unknown>;
  model: string;
  name: string;
  periodMs: number;
  priority: BudgetPriority;
  provider: string;
  resetStrategy: BudgetResetStrategy;
}

export interface TokenBudgetConfig extends Omit<TokenBudget, 'id'> {
  id?: string;
}

export interface BudgetFilter {
  model?: string;
  priority?: BudgetPriority;
  provider?: string;
}

export interface TokenUsage {
  budgetId: string;
  cost: number;
  metadata?: Record<string, unknown>;
  model: string;
  provider: string;
  requestType: RequestType;
  timestamp: Date;
  tokensUsed: number;
}

export interface UsageFilter {
  budgetId?: string;
  from?: Date;
  model?: string;
  provider?: string;
  requestType?: RequestType;
  to?: Date;
}

export interface TokenRequest {
  budgetId?: string;
  estimatedCost?: number;
  estimatedTokens: number;
  metadata?: Record<string, unknown>;
  model: string;
  priority?: BudgetPriority;
  provider: string;
  requestType: RequestType;
}

export interface AllocationCondition {
  kind: 'budget' | 'rate-limit';
  message: string;
}

export interface TokenAllocation {
  allocatedCost: number;
  allocatedTokens: number;
  budgetId: string;
  conditions?: AllocationCondition[];
  expiresAt: Date;
  id: string;
}

export interface CostAnalysisBudgetSummary {
  budgetId: string;
  requestCount: number;
  totalCost: number;
  totalTokens: number;
}

export interface CostAnalysis {
  budgets: CostAnalysisBudgetSummary[];
  requestCount: number;
  totalCost: number;
  totalTokens: number;
}

export interface OptimizationSuggestion {
  budgetId: string;
  message: string;
  type: 'reduce-tokens' | 'reduce-cost' | 'rate-limit';
}

export interface TokenManager {
  createBudget(config: TokenBudgetConfig): Promise<TokenBudget>;
  deleteBudget(id: string): Promise<void>;
  getBudget(id: string): Promise<TokenBudget | null>;
  getCostAnalysis(periodMs: number): Promise<CostAnalysis>;
  getOptimizationSuggestions(budgetId: string): Promise<OptimizationSuggestion[]>;
  getUsage(filter?: UsageFilter): Promise<TokenUsage[]>;
  listBudgets(filter?: BudgetFilter): Promise<TokenBudget[]>;
  recordUsage(usage: TokenUsage): Promise<void>;
  releaseTokens(allocationId: string, actualUsage: number, actualCost?: number): Promise<void>;
  requestTokens(request: TokenRequest): Promise<TokenAllocation>;
  updateBudget(id: string, updates: Partial<Omit<TokenBudget, 'id'>>): Promise<TokenBudget>;
}

export interface RateLimit {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
  windowMs: number;
}

export interface PacingFeedback {
  overloaded?: boolean;
  provider: string;
  retryAfterMs?: number;
}

interface AllocationRecord {
  allocation: TokenAllocation;
  createdAt: number;
  request: TokenRequest;
}

function getBudgetPriorityRank(priority: BudgetPriority): number {
  switch (priority) {
    case 'high': {
      return 2;
    }
    case 'medium': {
      return 1;
    }
    case 'low': {
      return 0;
    }
    default: {
      return 0;
    }
  }
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function cloneBudget(budget: TokenBudget): TokenBudget {
  return {
    ...budget,
    ...(budget.metadata === undefined ? {} : { metadata: { ...budget.metadata } })
  };
}

function cloneUsage(usage: TokenUsage): TokenUsage {
  return {
    ...usage,
    timestamp: new Date(usage.timestamp),
    ...(usage.metadata === undefined ? {} : { metadata: { ...usage.metadata } })
  };
}

function cloneAllocation(allocation: TokenAllocation): TokenAllocation {
  return {
    ...allocation,
    expiresAt: new Date(allocation.expiresAt),
    ...(allocation.conditions === undefined ? {} : { conditions: [...allocation.conditions] })
  };
}

function isWithinWindow(timestamp: Date, now: number, periodMs: number): boolean {
  return now - timestamp.getTime() <= periodMs;
}

function filterBudget(budget: TokenBudget, filter: BudgetFilter): boolean {
  return (
    (filter.provider === undefined || budget.provider === filter.provider) &&
    (filter.model === undefined || budget.model === filter.model) &&
    (filter.priority === undefined || budget.priority === filter.priority)
  );
}

function filterUsage(usage: TokenUsage, filter: UsageFilter): boolean {
  return (
    (filter.budgetId === undefined || usage.budgetId === filter.budgetId) &&
    (filter.provider === undefined || usage.provider === filter.provider) &&
    (filter.model === undefined || usage.model === filter.model) &&
    (filter.requestType === undefined || usage.requestType === filter.requestType) &&
    (filter.from === undefined || usage.timestamp >= filter.from) &&
    (filter.to === undefined || usage.timestamp <= filter.to)
  );
}

function getAllocationCost(request: TokenRequest): number {
  return request.estimatedCost ?? 0;
}

function selectBudget(budgets: TokenBudget[], request: TokenRequest): TokenBudget | null {
  const matching = budgets.filter(
    budget => budget.provider === request.provider && (budget.model === request.model || budget.model === '*')
  );
  const candidates = matching.length > 0 ? matching : budgets.filter(budget => budget.provider === request.provider);
  if (candidates.length === 0) {
    return null;
  }

  return (
    [...candidates].toSorted(
      (left, right) => getBudgetPriorityRank(right.priority) - getBudgetPriorityRank(left.priority)
    )[0] ?? null
  );
}

function pruneTimestampsForWindow(timestamps: readonly number[], now: number, windowMs: number): number[] {
  return timestamps.filter(timestamp => now - timestamp < windowMs);
}

function getRetryAfterMs(
  recentTimestamps: readonly number[],
  now: number,
  windowMs: number,
  maxRequests: number
): number {
  if (recentTimestamps.length < maxRequests) {
    return 0;
  }

  const oldestTimestamp = recentTimestamps[0];
  if (oldestTimestamp === undefined) {
    return 0;
  }

  return Math.max(1, windowMs - (now - oldestTimestamp));
}

function sumUsageForBudget(budget: TokenBudget, usage: TokenUsage[], now: number): { tokens: number; cost: number } {
  return usage
    .filter(entry => entry.budgetId === budget.id)
    .filter(entry => {
      if (budget.resetStrategy === 'manual') {
        return true;
      }

      return isWithinWindow(entry.timestamp, now, budget.periodMs);
    })
    .reduce(
      (totals, entry) => ({
        cost: totals.cost + entry.cost,
        tokens: totals.tokens + entry.tokensUsed
      }),
      { cost: 0, tokens: 0 }
    );
}

function sumReservedForBudget(
  budgetId: string,
  allocations: Map<string, AllocationRecord>
): { tokens: number; cost: number } {
  return [...allocations.values()]
    .filter(record => record.allocation.budgetId === budgetId)
    .reduce(
      (totals, record) => ({
        cost: totals.cost + record.allocation.allocatedCost,
        tokens: totals.tokens + record.allocation.allocatedTokens
      }),
      { cost: 0, tokens: 0 }
    );
}

export function createInMemoryTokenManager(): TokenManager {
  const budgets = new Map<string, TokenBudget>();
  const allocations = new Map<string, AllocationRecord>();
  const usage: TokenUsage[] = [];

  return {
    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async createBudget(config) {
      const id = config.id ?? createId('budget');
      const budget: TokenBudget = {
        id,
        maxCost: config.maxCost,
        maxTokens: config.maxTokens,
        model: config.model,
        name: config.name,
        periodMs: config.periodMs,
        priority: config.priority,
        provider: config.provider,
        resetStrategy: config.resetStrategy,
        ...(config.metadata === undefined ? {} : { metadata: { ...config.metadata } })
      };
      budgets.set(id, budget);
      return cloneBudget(budget);
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async deleteBudget(id) {
      budgets.delete(id);
      for (const [allocationId, record] of allocations.entries()) {
        if (record.allocation.budgetId === id) {
          allocations.delete(allocationId);
        }
      }
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async getBudget(id) {
      const budget = budgets.get(id);
      return budget ? cloneBudget(budget) : null;
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async getCostAnalysis(periodMs) {
      const now = Date.now();
      const inWindow = usage.filter(entry => isWithinWindow(entry.timestamp, now, periodMs));
      const budgetSummaries = new Map<string, CostAnalysisBudgetSummary>();

      for (const entry of inWindow) {
        const existing = budgetSummaries.get(entry.budgetId) ?? {
          budgetId: entry.budgetId,
          requestCount: 0,
          totalCost: 0,
          totalTokens: 0
        };
        existing.totalTokens += entry.tokensUsed;
        existing.totalCost += entry.cost;
        existing.requestCount += 1;
        budgetSummaries.set(entry.budgetId, existing);
      }

      return {
        budgets: [...budgetSummaries.values()].toSorted((left, right) => left.budgetId.localeCompare(right.budgetId)),
        requestCount: inWindow.length,
        totalCost: inWindow.reduce((total, entry) => total + entry.cost, 0),
        totalTokens: inWindow.reduce((total, entry) => total + entry.tokensUsed, 0)
      };
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async getOptimizationSuggestions(budgetId) {
      const budget = budgets.get(budgetId);
      if (!budget) {
        return [];
      }

      const now = Date.now();
      const spent = sumUsageForBudget(budget, usage, now);
      const suggestions: OptimizationSuggestion[] = [];
      const tokenRatio = budget.maxTokens === 0 ? 0 : spent.tokens / budget.maxTokens;
      const costRatio = budget.maxCost === 0 ? 0 : spent.cost / budget.maxCost;

      if (tokenRatio >= 0.8) {
        suggestions.push({
          budgetId,
          message: 'Budget is above 80% token usage; compress conversation history or shorten prompts.',
          type: 'reduce-tokens'
        });
      }

      if (costRatio >= 0.8) {
        suggestions.push({
          budgetId,
          message: 'Budget is above 80% cost usage; consider a lower-cost model or shorter completions.',
          type: 'reduce-cost'
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          budgetId,
          message: 'Budget usage is healthy; keep monitoring burst traffic before raising limits.',
          type: 'rate-limit'
        });
      }

      return suggestions;
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async getUsage(filter = {}) {
      return usage.filter(entry => filterUsage(entry, filter)).map(cloneUsage);
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async listBudgets(filter = {}) {
      return [...budgets.values()].filter(budget => filterBudget(budget, filter)).map(cloneBudget);
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async recordUsage(entry) {
      usage.push(cloneUsage(entry));
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async releaseTokens(allocationId, actualUsage, actualCost = 0) {
      const record = allocations.get(allocationId);
      if (!record) {
        throw new Error(`Unknown token allocation: ${allocationId}`);
      }

      allocations.delete(allocationId);
      usage.push({
        budgetId: record.allocation.budgetId,
        cost: actualCost,
        model: record.request.model,
        provider: record.request.provider,
        requestType: record.request.requestType,
        timestamp: new Date(record.createdAt),
        tokensUsed: actualUsage,
        ...(record.request.metadata === undefined ? {} : { metadata: { ...record.request.metadata } })
      });
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async requestTokens(request) {
      const budget = request.budgetId
        ? (budgets.get(request.budgetId) ?? null)
        : selectBudget([...budgets.values()], request);
      if (!budget) {
        throw new Error('No matching token budget found for the request');
      }

      const now = Date.now();
      const spent = sumUsageForBudget(budget, usage, now);
      const reserved = sumReservedForBudget(budget.id, allocations);
      const nextTokens = spent.tokens + reserved.tokens + request.estimatedTokens;
      const nextCost = spent.cost + reserved.cost + getAllocationCost(request);

      if (nextTokens > budget.maxTokens) {
        throw new Error(`Token request exceeds the remaining token budget for ${budget.id}`);
      }

      if (nextCost > budget.maxCost) {
        throw new Error(`Token request exceeds the remaining cost budget for ${budget.id}`);
      }

      const allocation: TokenAllocation = {
        allocatedCost: getAllocationCost(request),
        allocatedTokens: request.estimatedTokens,
        budgetId: budget.id,
        expiresAt: new Date(now + budget.periodMs),
        id: createId('allocation')
      };

      allocations.set(allocation.id, {
        allocation,
        createdAt: now,
        request: {
          ...request,
          ...(request.metadata === undefined ? {} : { metadata: { ...request.metadata } })
        }
      });

      return cloneAllocation(allocation);
    },

    // biome-ignore lint/suspicious/useAwait: async needed for Promise<ReturnType> signature
    async updateBudget(id, updates) {
      const current = budgets.get(id);
      if (!current) {
        throw new Error(`Unknown token budget: ${id}`);
      }

      const next: TokenBudget = {
        ...current,
        ...updates,
        ...(updates.metadata === undefined ? {} : { metadata: { ...updates.metadata } })
      };
      budgets.set(id, next);
      return cloneBudget(next);
    }
  };
}

export class PacingController {
  readonly #manager: TokenManager;
  readonly #limits = new Map<string, RateLimit[]>();
  readonly #requestTimestamps = new Map<string, number[]>();
  readonly #cooldowns = new Map<string, number>();

  constructor(tokenManager: TokenManager) {
    this.#manager = tokenManager;
  }

  throttleRequest(request: TokenRequest): Promise<boolean> {
    const waitTime = this.getWaitTime(request);
    if (waitTime > 0) {
      return Promise.resolve(false);
    }

    const timestamps = this.#requestTimestamps.get(request.provider) ?? [];
    timestamps.push(Date.now());
    this.#requestTimestamps.set(request.provider, timestamps);
    return Promise.resolve(true);
  }

  getWaitTime(request: TokenRequest): number {
    const providerCooldown = this.#cooldowns.get(request.provider);
    const now = Date.now();
    const cooldownWait = providerCooldown === undefined ? 0 : Math.max(0, providerCooldown - now);
    const rateLimitStatus = this.checkRateLimit(request.provider);
    return Math.max(cooldownWait, rateLimitStatus.retryAfterMs);
  }

  updateRateLimits(provider: string, limits: RateLimit[]): void {
    this.#limits.set(
      provider,
      limits.map(limit => ({ ...limit }))
    );
  }

  checkRateLimit(provider: string): RateLimitStatus {
    const limits = this.#limits.get(provider) ?? [];
    if (limits.length === 0) {
      return {
        allowed: true,
        limit: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        retryAfterMs: 0,
        windowMs: 0
      };
    }

    const now = Date.now();
    const timestamps = this.#requestTimestamps.get(provider) ?? [];
    const maxWindowMs = limits.reduce((maxWindow, limit) => Math.max(maxWindow, limit.windowMs), 0);
    let strictest: RateLimitStatus = {
      allowed: true,
      limit: 0,
      remaining: Number.MAX_SAFE_INTEGER,
      retryAfterMs: 0,
      windowMs: 0
    };

    for (const limit of limits) {
      const recent = pruneTimestampsForWindow(timestamps, now, limit.windowMs);
      const remaining = Math.max(0, limit.maxRequests - recent.length);
      const retryAfterMs = getRetryAfterMs(recent, now, limit.windowMs, limit.maxRequests);
      const candidate: RateLimitStatus = {
        allowed: retryAfterMs === 0,
        limit: limit.maxRequests,
        remaining,
        retryAfterMs,
        windowMs: limit.windowMs
      };

      if (!candidate.allowed) {
        return candidate;
      }

      if (candidate.remaining < strictest.remaining) {
        strictest = candidate;
      }
    }

    this.#requestTimestamps.set(provider, pruneTimestampsForWindow(timestamps, now, maxWindowMs));

    return strictest;
  }

  adjustPacing(feedback: PacingFeedback): void {
    if (feedback.overloaded === true && typeof feedback.retryAfterMs === 'number') {
      this.#cooldowns.set(feedback.provider, Date.now() + Math.max(0, feedback.retryAfterMs));
      return;
    }

    if (feedback.overloaded === false || feedback.retryAfterMs === 0) {
      this.#cooldowns.delete(feedback.provider);
    }
  }

  get tokenManager(): TokenManager {
    return this.#manager;
  }
}
