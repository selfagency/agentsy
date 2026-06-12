/**
 * Unified tokenizer interface.
 *
 * Implementations wrap model-specific BPE tokenizers (tiktoken for OpenAI,
 * Anthropic's tokenizer for Claude, etc.) with a consistent API. Every
 * tokenizer must be explicitly freed to release WASM memory.
 */
export interface Tokenizer {
  /** Tokenise text and return the number of tokens. */
  count(text: string): number;

  /** Decode token IDs back into text. */
  decode(tokens: Uint32Array | number[]): string;

  /** Tokenise text into individual token IDs. */
  encode(text: string): Uint32Array;

  /** Release native / WASM resources. No-op for estimation-based tokenizers. */
  free(): void;
  /** Human-readable model family / tokenizer name (e.g. "cl100k_base"). */
  readonly name: string;
}

/**
 * Factory that produces a Tokenizer for a given model name.
 */
export type TokenizerFactory = (modelName: string) => Tokenizer;

/**
 * A resolved tokenizer entry in the registry.
 */
export interface TokenizerEntry {
  /** Which encoding family this model uses. */
  encoding: string;

  /** Factory that builds the tokenizer. */
  factory: TokenizerFactory;
  /** Glob or exact model-name pattern (e.g. "gpt-4*", "claude-*"). */
  pattern: string;
}

/**
 * Count result with optional fallback reason.
 */
export interface CountResult {
  method: 'exact' | 'estimated';
  /** Human-readable justification when estimated. */
  reason?: string;
  tokens: number;
}

/**
 * Lightweight token counter for environments where WASM is unavailable.
 *
 * Only supports `count` — does not provide `encode`, `decode`, or `free`.
 */
export interface SyncTokenizer {
  count(text: string): number;
  readonly name: string;
}
