// @agentsy/tokens — Token budgets, context reduction, and output shaping.

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
  name: string;
  provider: string;
  model: string;
  maxTokens: number;
  maxCost: number;
  periodMs: number;
  resetStrategy: BudgetResetStrategy;
  priority: BudgetPriority;
  metadata?: Record<string, unknown>;
}

export interface TokenBudgetConfig extends Omit<TokenBudget, 'id'> {
  id?: string;
}

export interface BudgetFilter {
  provider?: string;
  model?: string;
  priority?: BudgetPriority;
}

export interface TokenUsage {
  budgetId: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  timestamp: Date;
  requestType: RequestType;
  metadata?: Record<string, unknown>;
}

export interface UsageFilter {
  budgetId?: string;
  provider?: string;
  model?: string;
  requestType?: RequestType;
  from?: Date;
  to?: Date;
}

export interface TokenRequest {
  budgetId?: string;
  provider: string;
  model: string;
  estimatedTokens: number;
  estimatedCost?: number;
  priority?: BudgetPriority;
  requestType: RequestType;
  metadata?: Record<string, unknown>;
}

export interface AllocationCondition {
  kind: 'budget' | 'rate-limit';
  message: string;
}

export interface TokenAllocation {
  id: string;
  budgetId: string;
  allocatedTokens: number;
  allocatedCost: number;
  expiresAt: Date;
  conditions?: AllocationCondition[];
}

export interface CostAnalysisBudgetSummary {
  budgetId: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
}

export interface CostAnalysis {
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  budgets: CostAnalysisBudgetSummary[];
}

export interface OptimizationSuggestion {
  budgetId: string;
  type: 'reduce-tokens' | 'reduce-cost' | 'rate-limit';
  message: string;
}

export interface TokenManager {
  createBudget(config: TokenBudgetConfig): Promise<TokenBudget>;
  getBudget(id: string): Promise<TokenBudget | null>;
  updateBudget(id: string, updates: Partial<Omit<TokenBudget, 'id'>>): Promise<TokenBudget>;
  deleteBudget(id: string): Promise<void>;
  listBudgets(filter?: BudgetFilter): Promise<TokenBudget[]>;
  requestTokens(request: TokenRequest): Promise<TokenAllocation>;
  releaseTokens(allocationId: string, actualUsage: number, actualCost?: number): Promise<void>;
  recordUsage(usage: TokenUsage): Promise<void>;
  getUsage(filter?: UsageFilter): Promise<TokenUsage[]>;
  getCostAnalysis(periodMs: number): Promise<CostAnalysis>;
  getOptimizationSuggestions(budgetId: string): Promise<OptimizationSuggestion[]>;
}

export interface CompressionOptions<TMessage> {
  maxTokens: number;
  preserveLast?: number;
  estimateTokens?: (message: TMessage) => number;
}

export interface CompressionResult<TMessage> {
  messages: TMessage[];
  droppedCount: number;
  estimatedTokens: number;
  compressed: boolean;
}

export interface RateLimit {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  windowMs: number;
  retryAfterMs: number;
}

export interface PacingFeedback {
  provider: string;
  overloaded?: boolean;
  retryAfterMs?: number;
}

interface AllocationRecord {
  allocation: TokenAllocation;
  request: TokenRequest;
  createdAt: number;
}

const PRIORITY_ORDER: Record<BudgetPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const DEFAULT_ESTIMATE_TOKENS = <TMessage>(message: TMessage): number => {
  if (typeof message === 'string') {
    return Math.max(1, Math.ceil(message.length / 4));
  }

  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
};

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneBudget(budget: TokenBudget): TokenBudget {
  return {
    ...budget,
    ...(budget.metadata === undefined ? {} : { metadata: { ...budget.metadata } }),
  };
}

function cloneUsage(usage: TokenUsage): TokenUsage {
  return {
    ...usage,
    timestamp: new Date(usage.timestamp),
    ...(usage.metadata === undefined ? {} : { metadata: { ...usage.metadata } }),
  };
}

function cloneAllocation(allocation: TokenAllocation): TokenAllocation {
  return {
    ...allocation,
    expiresAt: new Date(allocation.expiresAt),
    ...(allocation.conditions === undefined ? {} : { conditions: [...allocation.conditions] }),
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
    budget => budget.provider === request.provider && (budget.model === request.model || budget.model === '*'),
  );
  const candidates = matching.length > 0 ? matching : budgets.filter(budget => budget.provider === request.provider);
  if (candidates.length === 0) {
    return null;
  }

  return (
    [...candidates].sort((left, right) => PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority])[0] ?? null
  );
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
        tokens: totals.tokens + entry.tokensUsed,
        cost: totals.cost + entry.cost,
      }),
      { tokens: 0, cost: 0 },
    );
}

function sumReservedForBudget(
  budgetId: string,
  allocations: Map<string, AllocationRecord>,
): { tokens: number; cost: number } {
  return [...allocations.values()]
    .filter(record => record.allocation.budgetId === budgetId)
    .reduce(
      (totals, record) => ({
        tokens: totals.tokens + record.allocation.allocatedTokens,
        cost: totals.cost + record.allocation.allocatedCost,
      }),
      { tokens: 0, cost: 0 },
    );
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
    },
  };
};

export function compressConversation<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>,
): CompressionResult<TMessage> {
  const estimateTokens = options.estimateTokens ?? DEFAULT_ESTIMATE_TOKENS<TMessage>;
  const preserveLast = Math.max(0, options.preserveLast ?? 0);
  const retained = [...messages];

  let estimatedTokens = retained.reduce((total, message) => total + estimateTokens(message), 0);
  let droppedCount = 0;

  while (retained.length > preserveLast && estimatedTokens > options.maxTokens) {
    const removed = retained.shift();
    if (removed === undefined) {
      break;
    }

    estimatedTokens -= estimateTokens(removed);
    droppedCount += 1;
  }

  return {
    messages: retained,
    droppedCount,
    estimatedTokens: Math.max(0, estimatedTokens),
    compressed: droppedCount > 0,
  };
}

export function createInMemoryTokenManager(): TokenManager {
  const budgets = new Map<string, TokenBudget>();
  const allocations = new Map<string, AllocationRecord>();
  const usage: TokenUsage[] = [];

  return {
    async createBudget(config) {
      const id = config.id ?? createId('budget');
      const budget: TokenBudget = {
        id,
        name: config.name,
        provider: config.provider,
        model: config.model,
        maxTokens: config.maxTokens,
        maxCost: config.maxCost,
        periodMs: config.periodMs,
        resetStrategy: config.resetStrategy,
        priority: config.priority,
        ...(config.metadata === undefined ? {} : { metadata: { ...config.metadata } }),
      };
      budgets.set(id, budget);
      return cloneBudget(budget);
    },

    async getBudget(id) {
      const budget = budgets.get(id);
      return budget ? cloneBudget(budget) : null;
    },

    async updateBudget(id, updates) {
      const current = budgets.get(id);
      if (!current) {
        throw new Error(`Unknown token budget: ${id}`);
      }

      const next: TokenBudget = {
        ...current,
        ...updates,
        ...(updates.metadata === undefined ? {} : { metadata: { ...updates.metadata } }),
      };
      budgets.set(id, next);
      return cloneBudget(next);
    },

    async deleteBudget(id) {
      budgets.delete(id);
      for (const [allocationId, record] of allocations.entries()) {
        if (record.allocation.budgetId === id) {
          allocations.delete(allocationId);
        }
      }
    },

    async listBudgets(filter = {}) {
      return [...budgets.values()].filter(budget => filterBudget(budget, filter)).map(cloneBudget);
    },

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
        id: createId('allocation'),
        budgetId: budget.id,
        allocatedTokens: request.estimatedTokens,
        allocatedCost: getAllocationCost(request),
        expiresAt: new Date(now + budget.periodMs),
      };

      allocations.set(allocation.id, {
        allocation,
        request: {
          ...request,
          ...(request.metadata === undefined ? {} : { metadata: { ...request.metadata } }),
        },
        createdAt: now,
      });

      return cloneAllocation(allocation);
    },

    async releaseTokens(allocationId, actualUsage, actualCost = 0) {
      const record = allocations.get(allocationId);
      if (!record) {
        throw new Error(`Unknown token allocation: ${allocationId}`);
      }

      allocations.delete(allocationId);
      usage.push({
        budgetId: record.allocation.budgetId,
        provider: record.request.provider,
        model: record.request.model,
        tokensUsed: actualUsage,
        cost: actualCost,
        timestamp: new Date(record.createdAt),
        requestType: record.request.requestType,
        ...(record.request.metadata === undefined ? {} : { metadata: { ...record.request.metadata } }),
      });
    },

    async recordUsage(entry) {
      usage.push(cloneUsage(entry));
    },

    async getUsage(filter = {}) {
      return usage.filter(entry => filterUsage(entry, filter)).map(cloneUsage);
    },

    async getCostAnalysis(periodMs) {
      const now = Date.now();
      const inWindow = usage.filter(entry => isWithinWindow(entry.timestamp, now, periodMs));
      const budgetSummaries = new Map<string, CostAnalysisBudgetSummary>();

      for (const entry of inWindow) {
        const existing = budgetSummaries.get(entry.budgetId) ?? {
          budgetId: entry.budgetId,
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0,
        };
        existing.totalTokens += entry.tokensUsed;
        existing.totalCost += entry.cost;
        existing.requestCount += 1;
        budgetSummaries.set(entry.budgetId, existing);
      }

      return {
        totalTokens: inWindow.reduce((total, entry) => total + entry.tokensUsed, 0),
        totalCost: inWindow.reduce((total, entry) => total + entry.cost, 0),
        requestCount: inWindow.length,
        budgets: [...budgetSummaries.values()].sort((left, right) => left.budgetId.localeCompare(right.budgetId)),
      };
    },

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
          type: 'reduce-tokens',
          message: 'Budget is above 80% token usage; compress conversation history or shorten prompts.',
        });
      }

      if (costRatio >= 0.8) {
        suggestions.push({
          budgetId,
          type: 'reduce-cost',
          message: 'Budget is above 80% cost usage; consider a lower-cost model or shorter completions.',
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          budgetId,
          type: 'rate-limit',
          message: 'Budget usage is healthy; keep monitoring burst traffic before raising limits.',
        });
      }

      return suggestions;
    },
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

  async throttleRequest(request: TokenRequest): Promise<boolean> {
    const waitTime = await this.getWaitTime(request);
    if (waitTime > 0) {
      return false;
    }

    const timestamps = this.#requestTimestamps.get(request.provider) ?? [];
    timestamps.push(Date.now());
    this.#requestTimestamps.set(request.provider, timestamps);
    return true;
  }

  async getWaitTime(request: TokenRequest): Promise<number> {
    const providerCooldown = this.#cooldowns.get(request.provider);
    const now = Date.now();
    const cooldownWait = providerCooldown === undefined ? 0 : Math.max(0, providerCooldown - now);
    const rateLimitStatus = await this.checkRateLimit(request.provider);
    return Math.max(cooldownWait, rateLimitStatus.retryAfterMs);
  }

  async updateRateLimits(provider: string, limits: RateLimit[]): Promise<void> {
    this.#limits.set(
      provider,
      limits.map(limit => ({ ...limit })),
    );
  }

  async checkRateLimit(provider: string): Promise<RateLimitStatus> {
    const limits = this.#limits.get(provider) ?? [];
    if (limits.length === 0) {
      return {
        allowed: true,
        limit: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        windowMs: 0,
        retryAfterMs: 0,
      };
    }

    const now = Date.now();
    const timestamps = this.#requestTimestamps.get(provider) ?? [];
    let strictest: RateLimitStatus = {
      allowed: true,
      limit: 0,
      remaining: Number.MAX_SAFE_INTEGER,
      windowMs: 0,
      retryAfterMs: 0,
    };

    for (const limit of limits) {
      const recent = timestamps.filter(timestamp => now - timestamp < limit.windowMs);
      this.#requestTimestamps.set(provider, recent);
      const remaining = Math.max(0, limit.maxRequests - recent.length);
      const retryAfterMs = recent.length >= limit.maxRequests ? Math.max(1, limit.windowMs - (now - recent[0]!)) : 0;
      const candidate: RateLimitStatus = {
        allowed: retryAfterMs === 0,
        limit: limit.maxRequests,
        remaining,
        windowMs: limit.windowMs,
        retryAfterMs,
      };

      if (!candidate.allowed) {
        return candidate;
      }

      if (candidate.remaining < strictest.remaining) {
        strictest = candidate;
      }
    }

    return strictest;
  }

  async adjustPacing(feedback: PacingFeedback): Promise<void> {
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
