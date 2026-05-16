import type { RAGEvidence, RAGWeightConfig } from "./types.js";

export function rerankResults(
  results: readonly RAGEvidence[],
  weights: RAGWeightConfig
): RAGEvidence[] {
  return [...results]
    .map((item) => {
      const final =
        item.scoreBreakdown.vector * weights.vector +
        item.scoreBreakdown.lexical * weights.lexical +
        item.scoreBreakdown.entity * weights.entity +
        item.scoreBreakdown.temporal * weights.temporal;

      return {
        ...item,
        confidence: Math.max(0, Math.min(1, final)),
        score: final,
        scoreBreakdown: {
          ...item.scoreBreakdown,
          final,
        },
      };
    })
    .toSorted((left, right) => right.score - left.score);
}
