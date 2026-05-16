import type { PlannedQuery } from "./types.js";

export interface QueryPlanner {
  plan(input: { query: string; scope?: string; limit?: number }): PlannedQuery;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "for",
  "of",
  "in",
  "on",
  "and",
]);

function normalizeTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .filter((term) => !STOP_WORDS.has(term));
}

export function createQueryPlanner(): QueryPlanner {
  return {
    plan(input) {
      const expandedTerms = normalizeTerms(input.query);
      const entities = expandedTerms.filter((term) => term.length > 4);

      return {
        query: input.query,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
        expandedTerms,
        entities,
        limit: Math.max(1, input.limit ?? 8),
      };
    },
  };
}
