import type { Tokenizer } from './types.js';

/**
 * Fallback token estimator used when no specific BPE tokenizer is available.
 *
 * Uses a tuned character-to-token ratio per model family to produce a
 * reasonable estimate for budget management and cost attribution.
 *
 * These ratios are empirically derived:
 * - GPT-4 / Claude: ~3.5 chars/token (complex text, more token overhead)
 * - GPT-3.5 / Llama: ~4 chars/token
 * - Code models: ~2 chars/token (compact syntax, high token density)
 * - Default: ~4 chars/token (conservative overestimate)
 */
export class EstimatorTokenizer implements Tokenizer {
  readonly name: string;

  private readonly charsPerToken: number;

  constructor(name: string, charsPerToken = 4) {
    this.name = name;
    this.charsPerToken = charsPerToken;
  }

  count(text: string): number {
    if (text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / this.charsPerToken);
  }

  encode(_text: string): Uint32Array {
    return new Uint32Array(0);
  }

  decode(_tokens: Uint32Array | number[]): string {
    return '';
  }

  free(): void {
    /* no-op: estimator uses no external resources */
  }
}

/** Pre-built estimators for common model families. */
export const defaultEstimators = {
  gpt4: new EstimatorTokenizer('gpt4-estimate', 3.5),
  gpt35: new EstimatorTokenizer('gpt35-estimate', 4),
  claude: new EstimatorTokenizer('claude-estimate', 3.5),
  code: new EstimatorTokenizer('code-estimate', 2),
  default: new EstimatorTokenizer('default', 4)
} as const;

/**
 * Estimate the token count for a text using the default fallback ratio.
 */
export function estimateTokenCount(text: string, charsPerToken = 4): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / charsPerToken);
}
