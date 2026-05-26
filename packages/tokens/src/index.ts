// @agentsy/tokens — Token budgets, context reduction, and output shaping.

import { randomUUID } from 'node:crypto';

import stopwords from './stopwords.json' with { type: 'json' };

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

export interface CompressionOptions<TMessage> {
  estimateTokens?: (message: TMessage) => number;
  maxTokens: number;
  preserveLast?: number;
}

export interface CompressionResult<TMessage> {
  compressed: boolean;
  droppedCount: number;
  estimatedTokens: number;
  messages: TMessage[];
}

export type OutputCompressionLevel = 'lite' | 'full' | 'ultra';

export interface OutputCompressionOptions {
  intensity?: number;
  level: OutputCompressionLevel;
  preserve?: ('code' | 'technical' | 'urls' | 'paths' | 'markdown' | 'errors')[];
}

export interface OutputCompressionResult {
  compressed: string;
  compressedTokens: number;
  original: string;
  originalTokens: number;
  savingsRatio: number;
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

const DEFAULT_ESTIMATE_TOKENS = <TMessage>(message: TMessage): number => {
  if (typeof message === 'string') {
    return Math.max(1, Math.ceil(message.length / 4));
  }

  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
};

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

export function compressConversation<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>
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
    compressed: droppedCount > 0,
    droppedCount,
    estimatedTokens: Math.max(0, estimatedTokens),
    messages: retained
  };
}

const CODE_FENCE_PATTERN = /```[\s\S]*?```/gu;
const DEFAULT_PRESERVATION_SET: ReadonlySet<string> = new Set(['code', 'urls', 'paths', 'markdown', 'errors']);
const FILLER_WORDS = new Set([
  'really',
  'very',
  'just',
  'actually',
  'basically',
  'simply',
  'quite',
  'definitely',
  'certainly',
  'absolutely',
  'clearly',
  'obviously',
  'perhaps',
  'maybe',
  'apparently',
  'evidently',
  'fortunately',
  'unfortunately',
  'however',
  'thus',
  'therefore',
  'moreover',
  'furthermore',
  'additionally',
  'also',
  'indeed',
  'otherwise',
  'meanwhile',
  'primarily',
  'largely',
  'mostly',
  'thoroughly',
  'remarkably',
  'practically',
  'exceptionally',
  'notably',
  'particularly',
  'significantly',
  'essentially',
  'fundamentally',
  'well',
  'rather',
  'somewhat',
  'fairly',
  'pretty',
  'awfully',
  'terribly',
  'super',
  'extremely'
]);
const STOP_WORDS = new Set(
  stopwords
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length > 0)
);

const REDUNDANT_PHRASES: readonly [RegExp, string][] = [
  [/\b(is\s+)?(really\s+)?(quite\s+)?(very\s+)?(basically|essentially|fundamentally|practically)\s+/giu, ''],
  [/\b(that|which)\s+is\s+(really|very|quite|basically)\s+/giu, 'that '],
  [/\bthe\s+reason\s+(is\s+)?(that|why)\s+/giu, 'because '],
  [/\bit\s+(seems|appears|looks|sounds)\s+(that\s+)?(really|very|quite)\s+/giu, ''],
  [/\bas\s+mentioned\b/giu, ''],
  [/\bas\s+you\s+may\s+know\b/giu, ''],
  [/\bin\s+conclusion/giu, 'Finally'],
  [/\bdue\s+to\s+the\s+fact\s+that\b/giu, 'because'],
  [/\bat\s+this\s+point\s+in\s+time\b/giu, 'now']
];

const ABBREVIATIONS: readonly [RegExp, string][] = [
  [/\bapproximately\b/giu, 'approx'],
  [/\bconfiguration\b/giu, 'config'],
  [/\binformation\b/giu, 'info'],
  [/\badministration\b/giu, 'admin'],
  [/\bdocumentation\b/giu, 'docs'],
  [/\bdirectory\b/giu, 'dir'],
  [/\bnumber\b/giu, '#'],
  [/\btechnology\b/giu, 'tech'],
  [/\bimplementation\b/giu, 'impl'],
  [/\boperation\b/giu, 'op'],
  [/\bgeneral\b/giu, 'gen']
];

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function applyReplacements(source: string, replacements: readonly [RegExp, string][]): string {
  let result = source;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function normalizeAndDedupeLines(segment: string): string {
  const lines = segment.split('\n');
  const dedupedLines: string[] = [];
  let lastComparable = '';
  let previousWasBlank = false;

  for (const rawLine of lines) {
    const line = rawLine.replaceAll(/\s+/gu, ' ').trimEnd();
    const isBlank = line.trim().length === 0;

    if (isBlank) {
      if (!previousWasBlank) {
        dedupedLines.push('');
      }
      previousWasBlank = true;
      continue;
    }

    previousWasBlank = false;

    const comparable = line.trim().toLowerCase();
    if (comparable === lastComparable) {
      continue;
    }

    lastComparable = comparable;
    dedupedLines.push(line);
  }

  return dedupedLines.join('\n').trim();
}

function protectPreservedContent(
  source: string,
  preserve: ReadonlySet<string>
): { masked: string; restore: (value: string) => string } {
  const preserved: string[] = [];
  const stash = (value: string): string => {
    const index = preserved.push(value) - 1;
    return `__AGENTSY_PRESERVE_${index}__`;
  };

  let masked = source;

  if (preserve.has('urls')) {
    masked = masked.replaceAll(/https?:\/\/[^\s)]+/gu, stash);
  }

  if (preserve.has('paths')) {
    masked = masked.replaceAll(
      /(^|\s)(\.\.?\/|~\/|\/[A-Za-z0-9._/-]+)/gu,
      (_, prefix: string, path: string) => `${prefix}${stash(path)}`
    );
  }

  if (preserve.has('markdown')) {
    masked = masked.replaceAll(/`[^`]+`/gu, stash);
    masked = protectMarkdownLinks(masked, stash);
  }

  if (preserve.has('errors')) {
    // nosemgrep: regex-dos-error-pattern
    // Input is bounded LLM token output; pattern has no nested quantifiers.
    masked = masked.replaceAll(/\b(?:error|exception|errno)\s*[:#]?\s*[A-Z0-9_-]+\b/giu, stash);
  }

  if (preserve.has('technical')) {
    // nosemgrep: regex-dos-technical-pattern
    // Input is bounded LLM token output; pattern has no nested quantifiers.
    masked = masked.replaceAll(/\b[A-Za-z_]+\([\w\s,.:<>'"-]*\)/gu, stash);
  }

  const restore = (value: string): string =>
    value.replaceAll(/__AGENTSY_PRESERVE_(\d+)__/gu, (_, indexRaw: string) => {
      const index = Number(indexRaw);
      return preserved[index] ?? '';
    });

  return { masked, restore };
}

function protectMarkdownLinks(source: string, stash: (value: string) => string): string {
  let result = '';
  let index = 0;

  while (index < source.length) {
    const start = source.indexOf('[', index);
    if (start === -1) {
      return result + source.slice(index);
    }

    const closeBracket = source.indexOf(']', start + 1);
    const openParen = closeBracket === -1 ? -1 : source.indexOf('(', closeBracket + 1);
    const closeParen = openParen === -1 ? -1 : source.indexOf(')', openParen + 1);

    if (closeBracket === -1 || openParen !== closeBracket + 1 || closeParen === -1) {
      result += source.slice(index, start + 1);
      index = start + 1;
      continue;
    }

    result += source.slice(index, start);
    result += stash(source.slice(start, closeParen + 1));
    index = closeParen + 1;
  }

  return result;
}

function stripFillerWords(source: string, strongOnly: boolean): string {
  const strongWords = new Set(['really', 'very', 'just', 'basically', 'simply']);
  return source
    .split(/(\s+)/u)
    .map(segment => {
      if (/^\s+$/u.test(segment) || segment.length === 0) {
        return segment;
      }

      const normalized = segment.toLowerCase();
      const isShortToken = normalized.length <= 2;
      const shouldRemove = strongOnly
        ? strongWords.has(normalized)
        : FILLER_WORDS.has(normalized) || (!isShortToken && STOP_WORDS.has(normalized));

      return shouldRemove ? '' : segment;
    })
    .join('');
}

function finalizeWhitespace(source: string): string {
  return source.replaceAll(/\s{2,}/gu, ' ').trim();
}

function compressNonCodeSegment(segment: string, level: OutputCompressionLevel, preserve: ReadonlySet<string>): string {
  const joined = normalizeAndDedupeLines(segment);
  if (joined.length === 0) {
    return '';
  }

  const { masked, restore } = protectPreservedContent(joined, preserve);

  switch (level) {
    case 'lite': {
      const result = finalizeWhitespace(stripFillerWords(masked, true));
      return restore(result);
    }

    case 'full': {
      const withoutFiller = stripFillerWords(masked, false);
      const reduced = applyReplacements(withoutFiller, REDUNDANT_PHRASES);
      return restore(finalizeWhitespace(reduced));
    }

    case 'ultra': {
      const withoutFiller = stripFillerWords(masked, false);
      const reduced = normalizeUltraText(applyReplacements(withoutFiller, REDUNDANT_PHRASES));
      const abbreviated = applyReplacements(reduced, ABBREVIATIONS).replaceAll(
        /\b(?:the|a|an)\s+([a-z]+)\b/giu,
        (_, adjective: string) => `${adjective} `
      );

      return restore(
        abbreviated
          .replaceAll(/\s{2,}/gu, ' ')
          .replaceAll(/ ([,.])/gu, '$1')
          .trim()
      );
    }
    default: {
      return segment;
    }
  }
}

function normalizeUltraText(source: string): string {
  let output = source.replaceAll(/\b(and|or)\s+\1\s+/giu, '$1 ').replaceAll(/\b(is|are|was|were)\s+quite\s+/giu, '');

  output = removeWhichClauses(output);
  return output.replaceAll(/ ([,.?!])/gu, '$1');
}

function removeWhichClauses(source: string): string {
  const needle = ', which ';
  let index = 0;
  let output = '';

  while (index < source.length) {
    const matchIndex = source.toLowerCase().indexOf(needle, index);
    if (matchIndex === -1) {
      return output + source.slice(index);
    }

    output += source.slice(index, matchIndex);

    let clauseEnd = matchIndex + needle.length;
    while (clauseEnd < source.length && !',.?!'.includes(source[clauseEnd] ?? '')) {
      clauseEnd += 1;
    }

    if (clauseEnd < source.length) {
      output += source[clauseEnd];
      index = clauseEnd + 1;
    } else {
      index = clauseEnd;
    }
  }

  return output;
}

export function compressOutput(response: string, options: OutputCompressionOptions): OutputCompressionResult {
  const preserve = new Set(options.preserve ?? [...DEFAULT_PRESERVATION_SET]);
  const { level } = options;

  if (!preserve.has('code')) {
    const originalTokens = estimateTextTokens(response);
    const compressed = compressNonCodeSegment(response, level, preserve);
    const compressedTokens = estimateTextTokens(compressed);
    return {
      compressed,
      compressedTokens,
      original: response,
      originalTokens,
      savingsRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - compressedTokens) / originalTokens)
    };
  }

  const segments: { kind: 'code' | 'text'; value: string }[] = [];
  let lastIndex = 0;

  for (const match of response.matchAll(CODE_FENCE_PATTERN)) {
    const full = match[0];
    const start = match.index ?? lastIndex;
    const end = start + full.length;

    if (start > lastIndex) {
      segments.push({ kind: 'text', value: response.slice(lastIndex, start) });
    }

    segments.push({ kind: 'code', value: full });
    lastIndex = end;
  }

  if (lastIndex < response.length) {
    segments.push({ kind: 'text', value: response.slice(lastIndex) });
  }

  const compressed = segments
    .map(segment => (segment.kind === 'code' ? segment.value : compressNonCodeSegment(segment.value, level, preserve)))
    .join('\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim();

  const originalTokens = estimateTextTokens(response);
  const compressedTokens = estimateTextTokens(compressed);

  return {
    compressed,
    compressedTokens,
    original: response,
    originalTokens,
    savingsRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - compressedTokens) / originalTokens)
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

    async deleteBudget(id) {
      budgets.delete(id);
      for (const [allocationId, record] of allocations.entries()) {
        if (record.allocation.budgetId === id) {
          allocations.delete(allocationId);
        }
      }
    },

    async getBudget(id) {
      const budget = budgets.get(id);
      return budget ? cloneBudget(budget) : null;
    },

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

    async getUsage(filter = {}) {
      return usage.filter(entry => filterUsage(entry, filter)).map(cloneUsage);
    },

    async listBudgets(filter = {}) {
      return [...budgets.values()].filter(budget => filterBudget(budget, filter)).map(cloneBudget);
    },

    async recordUsage(entry) {
      usage.push(cloneUsage(entry));
    },

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
      limits.map(limit => ({ ...limit }))
    );
  }

  async checkRateLimit(provider: string): Promise<RateLimitStatus> {
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
