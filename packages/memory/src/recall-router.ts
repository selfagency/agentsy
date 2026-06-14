/**
 * Rule-based query router — maps natural language queries to search strategies
 * without any LLM calls.
 *
 * Inspired by cognee's SearchType router with weighted pattern matching.
 * Negation window prevents false positives ("not related" skips relationship search).
 * Override tracking detects misrouting patterns.
 */

export type SearchStrategy =
  | 'chunks' // Full-text lexical search for exact phrases
  | 'vector' // Vector similarity on embeddings (relationships, connected concepts)
  | 'session' // Session cache only (recent conversation context)
  | 'temporal' // Time-bounded recall (when/before/after queries)
  | 'graph_summary' // Summary/overview queries (tl;dr, explain)
  | 'code_rules' // Code-specific search (coding rules, refactoring, patterns)
  | 'hybrid'; // Default: vector + full-text + rerank

interface Rule {
  pattern: RegExp;
  strategy: SearchStrategy;
  weight: number;
}

const NEGATION_WINDOW = 20;

const RULES: Rule[] = [
  // Exact phrase search — highest weight
  { pattern: /"[^"]{3,}"/u, strategy: 'chunks', weight: 8 },

  // Cypher/syntax patterns
  { pattern: /\b(MATCH|RETURN|CREATE|WHERE)\b/u, strategy: 'chunks', weight: 10 },

  // Code patterns
  {
    pattern: /\b(def|return|async|await|import|export|class|interface|function|const)\b/u,
    strategy: 'code_rules',
    weight: 3
  },

  // Code review/refactoring patterns
  {
    pattern: /\b(coding rules|code review|refactoring|code style|lint|best practice|pattern)\b/iu,
    strategy: 'code_rules',
    weight: 5
  },

  // Relationship patterns
  {
    pattern: /\b(how is|how are|related to|connected to|linked to|relationship between)\b/iu,
    strategy: 'vector',
    weight: 5
  },

  // Summary/overview patterns
  {
    pattern: /\b(summarize|overview|tl;dr|give me the gist|what is|explain|why)\b/iu,
    strategy: 'graph_summary',
    weight: 4
  },

  // Step-by-step / reasoning patterns
  { pattern: /\b(step by step|walk me through|how do I|how to)\b/iu, strategy: 'hybrid', weight: 4 },

  // Temporal patterns
  {
    pattern: /\b(when did|when was|before|after|timeline|history|recently|earlier|yesterday)\b/iu,
    strategy: 'temporal',
    weight: 3
  },

  { pattern: /\b\d{4}s\b/u, strategy: 'temporal', weight: 6 },

  // Session context
  { pattern: /\b(what were we|what did I|last thing|earlier we|before that)\b/iu, strategy: 'session', weight: 4 },

  // Exact/literal
  { pattern: /\b(exact|verbatim|literal|precise wording)\b/iu, strategy: 'chunks', weight: 4 },

  // Connection/extension
  { pattern: /\b(connection|related|linked|associated with)\b/iu, strategy: 'vector', weight: 3 },

  // Reasoning (weaker signal)
  { pattern: /\b(because|therefore|since|as a result)\b/iu, strategy: 'graph_summary', weight: 2 }
];

function hasNegation(query: string, matchIndex: number): boolean {
  const before = query.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex);
  return /\b(not|n't|no|never)\b/iu.test(before);
}

export interface RouteResult {
  overrides: string[];
  strategy: SearchStrategy;
}

/**
 * Route a natural language query to the best search strategy.
 *
 * Uses weighted pattern matching — no LLM calls.
 * Override tracking records which rules were considered to surface
 * misrouting patterns over time.
 */
export function routeQuery(query: string): RouteResult {
  const overrides: string[] = [];
  let best: { strategy: SearchStrategy; weight: number } | null = null;

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0; // Reset for sticky regex
    const match = rule.pattern.exec(query);

    if (match !== null && !hasNegation(query, match.index)) {
      overrides.push(rule.strategy);

      if (best === null || rule.weight > best.weight) {
        best = { strategy: rule.strategy, weight: rule.weight };
      }
    }
  }

  if (best !== null) {
    return { strategy: best.strategy, overrides };
  }

  return { strategy: 'hybrid', overrides: [] };
}

/**
 * Normalize a user-provided scope string into a SearchStrategy.
 */
export function parseStrategy(input: string): SearchStrategy {
  const cleaned = input.trim().toLowerCase();

  switch (cleaned) {
    case 'chunks':
    case 'lexical':
      return 'chunks';
    case 'vector':
    case 'semantic':
      return 'vector';
    case 'session':
      return 'session';
    case 'temporal':
    case 'time':
      return 'temporal';
    case 'summary':
    case 'overview':
      return 'graph_summary';
    case 'code':
    case 'rules':
    case 'code_rules':
      return 'code_rules';
    default:
      return 'hybrid';
  }
}
