export interface RAGMetricsQueryInput {
  latencyMs: number;
  hits: number;
  cited: number;
  sourceMix: Record<string, number>;
}

export interface RAGMetricsSnapshot {
  queries: number;
  totalHits: number;
  averageLatencyMs: number;
  citationCoverage: number;
  sourceMix: Record<string, number>;
}

export interface RAGMetrics {
  recordQuery(input: RAGMetricsQueryInput): void;
  snapshot(): RAGMetricsSnapshot;
}

export function createRAGMetrics(): RAGMetrics {
  let queries = 0;
  let totalHits = 0;
  let totalLatency = 0;
  let totalCited = 0;
  const sourceMix = new Map<string, number>();

  return {
    recordQuery(input) {
      queries += 1;
      totalHits += Math.max(0, input.hits);
      totalLatency += Math.max(0, input.latencyMs);
      totalCited += Math.max(0, input.cited);

      for (const [key, value] of Object.entries(input.sourceMix)) {
        const current = sourceMix.get(key) ?? 0;
        sourceMix.set(key, current + Math.max(0, value));
      }
    },

    snapshot() {
      const normalizedSourceMix: Record<string, number> = {};
      for (const [key, value] of sourceMix.entries()) {
        normalizedSourceMix[key] = value;
      }

      return {
        averageLatencyMs: queries === 0 ? 0 : totalLatency / queries,
        citationCoverage: totalHits === 0 ? 0 : totalCited / totalHits,
        queries,
        sourceMix: normalizedSourceMix,
        totalHits,
      };
    },
  };
}
