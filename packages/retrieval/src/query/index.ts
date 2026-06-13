/**
 * Stage 1: Query Processing
 *
 * Classifies queries, generates HyDE hypothetical answers, and extracts keywords.
 * All local-first — classification uses pattern matching (not LLM) as default.
 */

export type QueryClass = 'factual_lookup' | 'reasoning' | 'creative' | 'multi_hop';

export interface ProcessedQuery {
  class: QueryClass;
  hypothetical?: string;
  keywords: string[];
  original: string;
}

/** Minimal LLM interface for HyDE rewriting. */
export interface QueryLlm {
  complete(opts: { messages: Array<{ content: string; role: 'user' | 'system' }> }): Promise<{ text: string }>;
}

export interface QueryProcessorOptions {
  /** LLM for HyDE rewriting — omit to skip hypothetical generation. */
  model?: QueryLlm;
}

const CLASS_PATTERNS: Array<{ pattern: RegExp; class: QueryClass }> = [
  // Multi-hop patterns first (specific before generic)
  {
    pattern:
      /\b(how does.*related|what.*relationship|compare and contrast|relationship between|chain of|multi-step|combining)\b/iu,
    class: 'multi_hop'
  },
  { pattern: /\b(write|create|generate|draft|compose|imagine|suggest|idea)\b/iu, class: 'creative' },
  { pattern: /\b(why|explain|how does|how would|what if|compare|contrast|analyze)\b/iu, class: 'reasoning' },
  { pattern: /\b(who|what|when|where|how many|how much|define|list)\b/iu, class: 'factual_lookup' },
  { pattern: /\b(and also|then|after that|subsequently|chain|sequence|connect)\b/iu, class: 'multi_hop' }
];

export class QueryProcessor {
  private readonly model: QueryLlm | undefined;

  constructor(options: QueryProcessorOptions = {}) {
    this.model = options.model;
  }

  async process(query: string): Promise<ProcessedQuery> {
    const queryClass = classifyQuery(query);
    const keywords = extractKeywords(query);

    let hypothetical: string | undefined;
    if ((queryClass === 'factual_lookup' || queryClass === 'multi_hop') && this.model) {
      try {
        const response = await this.model.complete({
          messages: [
            {
              role: 'system',
              content: "Write a concise hypothetical answer to the user's question. Base it on what you know."
            },
            { role: 'user', content: query }
          ]
        });
        hypothetical = response.text;
      } catch {
        // Non-fatal — proceed without HyDE
      }
    }

    const base: { class: QueryClass; keywords: string[]; original: string } = {
      class: queryClass,
      keywords,
      original: query
    };
    if (hypothetical !== undefined) {
      return { ...base, hypothetical };
    }
    return base;
  }
}

function classifyQuery(query: string): QueryClass {
  for (const { pattern, class: queryClass } of CLASS_PATTERNS) {
    if (pattern.test(query)) {
      return queryClass;
    }
  }
  return 'reasoning';
}

function extractKeywords(query: string): string[] {
  const cleaned = query.replace(/[^\w\s]/gu, '');
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'can',
    'had',
    'her',
    'was',
    'one',
    'our',
    'out',
    'has',
    'have',
    'been',
    'its',
    'who',
    'may',
    'way',
    'how',
    'did',
    'get',
    'use',
    'see',
    'new',
    'now',
    'any',
    'put',
    'let',
    'say',
    'try',
    'ask',
    'too',
    'own',
    'set',
    'end',
    'why',
    'yet',
    'she',
    'his',
    'him',
    'old'
  ]);
  const unique = new Set<string>();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (!stopWords.has(lower) && lower.length >= 3) {
      unique.add(lower);
    }
  }
  return [...unique];
}
