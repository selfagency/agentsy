/**
 * Fact extraction — LLM-powered observation extraction from conversation turns.
 *
 * Uses a minimal injectable LLM client interface so the memory package
 * does not couple to any specific provider/runtime.
 */

export type ExtractedFactKind = 'user_preference' | 'entity' | 'procedure' | 'constraint' | 'task_context';

export interface ExtractedFact {
  confidence: number;
  content: string;
  kind: ExtractedFactKind;
  sourceMessageId?: string;
}

/**
 * Minimal LLM client interface for dependency injection.
 */
export interface FactExtractorLlm {
  complete(options: {
    messages: Array<{ content: string; role: 'user' | 'system' }>;
    schema?: Record<string, unknown>;
  }): Promise<{ text: string }>;
}

export interface FactExtractorOptions {
  /** Minimum confidence threshold to include a fact (default: 0.5). */
  minConfidence?: number;
  /** LLM client used for extraction. */
  model: FactExtractorLlm;
}

const EXTRACTION_PROMPT = `Extract facts from this conversation turn.

Categories:
- user_preference: What the user likes, wants, or prefers
- entity: Named objects, people, places, or concepts
- procedure: How to do something, steps, workflows
- constraint: Limitations, restrictions, rules, or boundaries
- task_context: Current work context, goals, or focus

Return a JSON array of { kind, content, confidence (0-1) }.

Only extract facts with high confidence (≥0.6). Omit generic greetings.`;

/**
 * LLM-powered fact extractor.
 *
 * Uses an injected LLM client to extract structured facts from conversation
 * turns. Falls back to empty array on any error to avoid breaking the turn.
 */
export function createFactExtractor(options: FactExtractorOptions) {
  const minConfidence = options.minConfidence ?? 0.5;

  return {
    /**
     * Extract facts from a conversation turn.
     */
    async extract(turnContent: string): Promise<ExtractedFact[]> {
      try {
        const response = await options.model.complete({
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: turnContent }
          ]
        });

        const parsed = JSON.parse(response.text) as Array<{
          confidence: number;
          content: string;
          kind: ExtractedFactKind;
        }>;

        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed
          .filter(
            (f): f is ExtractedFact =>
              typeof f.content === 'string' &&
              f.content.length > 0 &&
              typeof f.confidence === 'number' &&
              f.confidence >= minConfidence &&
              ['user_preference', 'entity', 'procedure', 'constraint', 'task_context'].includes(f.kind)
          )
          .map(f => ({ confidence: f.confidence, content: f.content, kind: f.kind }));
      } catch {
        return [];
      }
    }
  };
}
