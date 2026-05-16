export interface RetrievalMetricsInput {
  latencyMs: number;
  hitCount: number;
  topScore?: number;
}

export interface InjectionMetricsInput {
  usedTokens: number;
  budgetTokens: number;
}

export interface CoordinationLatencyStats {
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
}

export interface MemoryMetricsSnapshot {
  coordination: Record<string, CoordinationLatencyStats>;
  retrieval: {
    queries: number;
    totalHits: number;
    averageLatencyMs: number;
    averageTopScore: number;
  };
  injection: {
    usedTokens: number;
    budgetTokens: number;
    budgetRatio: number;
  };
}

export interface MemoryMetrics {
  recordCoordinationLatency(operation: string, latencyMs: number): void;
  recordRetrieval(query: string, input: RetrievalMetricsInput): void;
  recordInjection(input: InjectionMetricsInput): void;
  snapshot(): MemoryMetricsSnapshot;
}

const SECRET_REDACTION_PATTERN =
  /(sk_[a-z0-9_-]{8,}|api[_-]?key\s*=\s*\S+|bearer\s+[a-z0-9._-]{10,})/giu;

export function redactSecretLikeValues(value: string): string {
  return value.replace(SECRET_REDACTION_PATTERN, "[REDACTED]");
}

interface MutableCoordinationStat {
  count: number;
  totalMs: number;
  maxMs: number;
}

export function createMemoryMetrics(): MemoryMetrics {
  const coordination = new Map<string, MutableCoordinationStat>();
  let retrievalQueries = 0;
  let retrievalTotalHits = 0;
  let retrievalTotalLatency = 0;
  let retrievalTopScoreSum = 0;
  let injectionUsedTokens = 0;
  let injectionBudgetTokens = 0;

  return {
    recordCoordinationLatency(operation, latencyMs) {
      const normalizedOperation = redactSecretLikeValues(operation);
      const stat = coordination.get(normalizedOperation) ?? {
        count: 0,
        maxMs: 0,
        totalMs: 0,
      };
      stat.count += 1;
      stat.totalMs += latencyMs;
      stat.maxMs = Math.max(stat.maxMs, latencyMs);
      coordination.set(normalizedOperation, stat);
    },

    recordInjection(input) {
      injectionUsedTokens += Math.max(0, input.usedTokens);
      injectionBudgetTokens += Math.max(0, input.budgetTokens);
    },

    recordRetrieval(_query, input) {
      // Query string is intentionally not accepted to reduce accidental data exposure.
      retrievalQueries += 1;
      retrievalTotalHits += Math.max(0, input.hitCount);
      retrievalTotalLatency += Math.max(0, input.latencyMs);
      retrievalTopScoreSum += Math.max(0, Math.min(1, input.topScore ?? 0));
    },

    snapshot() {
      const coordinationSnapshot: Record<string, CoordinationLatencyStats> = {};
      for (const [operation, stat] of coordination.entries()) {
        coordinationSnapshot[operation] = {
          avgMs: stat.count === 0 ? 0 : stat.totalMs / stat.count,
          count: stat.count,
          maxMs: stat.maxMs,
          totalMs: stat.totalMs,
        };
      }

      return {
        coordination: coordinationSnapshot,
        injection: {
          budgetRatio:
            injectionBudgetTokens === 0
              ? 0
              : injectionUsedTokens / injectionBudgetTokens,
          budgetTokens: injectionBudgetTokens,
          usedTokens: injectionUsedTokens,
        },
        retrieval: {
          averageLatencyMs:
            retrievalQueries === 0
              ? 0
              : retrievalTotalLatency / retrievalQueries,
          averageTopScore:
            retrievalQueries === 0
              ? 0
              : retrievalTopScoreSum / retrievalQueries,
          queries: retrievalQueries,
          totalHits: retrievalTotalHits,
        },
      };
    },
  };
}
