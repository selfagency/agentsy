import type { EstimatorTokenizer } from './estimate.js';
import { defaultEstimators, estimateTokenCount } from './estimate.js';
import { TiktokenPool } from './tiktoken.js';
import type { Tokenizer, TokenizerEntry } from './types.js';

/**
 * Model-aware tokenizer registry.
 *
 * Provides the right tokenizer for a given model name:
 * 1. Exact model match → tiktoken WASM
 * 2. Prefix/glob pattern match → tiktoken WASM
 * 3. Known family fallback → EstimatorTokenizer with tuned ratio
 * 4. Unknown model → default estimator (4 chars/token)
 */
export class TokenizerRegistry {
  private readonly tiktoken = new TiktokenPool();
  private readonly entries: TokenizerEntry[] = [];
  private readonly fallbacks = new Map<string, EstimatorTokenizer>();

  constructor() {
    this.registerDefaults();
  }

  // ── Registration ──────────────────────────────────────────────────

  /**
   * Register a tokenizer entry for a model name pattern.
   *
   * Entries are checked in LIFO order — later registrations override
   * earlier ones when patterns overlap.
   */
  register(entry: TokenizerEntry): void {
    this.entries.push(entry);
  }

  /**
   * Register a fallback estimator for a model-family prefix.
   *
   * Used when no exact tiktoken match is found.
   */
  registerFallback(prefix: string, estimator: EstimatorTokenizer): void {
    this.fallbacks.set(prefix, estimator);
  }

  // ── Tokenizer resolution ──────────────────────────────────────────

  /**
   * Resolve a tokenizer for the given model name.
   *
   * Returns a Tokenizer that can be used immediately. For exact token
   * counting with a `CountResult` wrapper, use `countTokens()` instead.
   */
  resolve(modelName: string): Tokenizer {
    // 1. Try exact matches and glob patterns against tiktoken entries
    const match = this.matchEntry(modelName);
    if (match !== undefined) {
      return match;
    }

    // 2. Try family-based fallback
    const fallback = this.matchFallback(modelName);
    if (fallback !== undefined) {
      return fallback;
    }

    // 3. Default estimator
    return defaultEstimators.default;
  }

  /**
   * Count tokens with metadata about counting method.
   */
  countTokens(modelName: string, text: string): { tokens: number; method: 'exact' | 'estimated'; reason?: string } {
    const match = this.matchEntry(modelName);
    if (match !== undefined) {
      return { tokens: match.count(text), method: 'exact' };
    }

    const fallback = this.matchFallback(modelName);
    if (fallback !== undefined) {
      return {
        tokens: fallback.count(text),
        method: 'estimated',
        reason: `Model "${modelName}" matched family fallback "${fallback.name}"`
      };
    }

    return {
      tokens: estimateTokenCount(text),
      method: 'estimated',
      reason: `Model "${modelName}" has no registered tokenizer; using default (4 chars/token)`
    };
  }

  /**
   * Release all cached WASM tokenizers. Call once at shutdown.
   */
  freeAll(): void {
    this.tiktoken.freeAll();
  }

  // ── Default registrations ─────────────────────────────────────────

  private registerDefaults(): void {
    // OpenAI models using o200k_base (GPT-4o+, o1, o3, etc.)
    this.register({
      pattern: 'gpt-4o*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'o1*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'o3*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'o4*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'chatgpt-*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'gpt-4.1*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'gpt-4.5*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });
    this.register({
      pattern: 'gpt-5*',
      encoding: 'o200k_base',
      factory: () => this.tiktoken.get('o200k_base')
    });

    // OpenAI models using cl100k_base (GPT-4, GPT-3.5, etc.)
    this.register({
      pattern: 'gpt-4*',
      encoding: 'cl100k_base',
      factory: () => this.tiktoken.get('cl100k_base')
    });
    this.register({
      pattern: 'gpt-3.5*',
      encoding: 'cl100k_base',
      factory: () => this.tiktoken.get('cl100k_base')
    });
    this.register({
      pattern: 'gpt-35*',
      encoding: 'cl100k_base',
      factory: () => this.tiktoken.get('cl100k_base')
    });
    this.register({
      pattern: 'text-embedding*',
      encoding: 'cl100k_base',
      factory: () => this.tiktoken.get('cl100k_base')
    });
    this.register({
      pattern: 'text-davinci*',
      encoding: 'p50k_base',
      factory: () => this.tiktoken.get('p50k_base')
    });

    // Model-family fallbacks (estimators)
    this.registerFallback('claude', defaultEstimators.claude);
    this.registerFallback('llama', defaultEstimators.default);
    this.registerFallback('mistral', defaultEstimators.default);
    this.registerFallback('gemma', defaultEstimators.default);
    this.registerFallback('gemini', defaultEstimators.default);
    this.registerFallback('command', defaultEstimators.default);
    this.registerFallback('codestral', defaultEstimators.code);
    this.registerFallback('qwen', defaultEstimators.default);
    this.registerFallback('deepseek', defaultEstimators.default);
    this.registerFallback('phi', defaultEstimators.default);
  }

  // ── Matching helpers ──────────────────────────────────────────────

  private matchEntry(modelName: string): Tokenizer | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry: TokenizerEntry | undefined = this.entries.at(i);
      if (entry !== undefined && this.matchesPattern(modelName, entry.pattern)) {
        return entry.factory(modelName);
      }
    }
  }

  private matchFallback(modelName: string): Tokenizer | undefined {
    const lower = modelName.toLowerCase();
    for (const [prefix, estimator] of this.fallbacks) {
      if (lower.startsWith(prefix)) {
        return estimator;
      }
    }
  }

  private matchesPattern(modelName: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return modelName === pattern;
    }
    const prefix = pattern.slice(0, pattern.indexOf('*'));
    return modelName.startsWith(prefix);
  }
}
