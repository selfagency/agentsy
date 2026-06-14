import {
  encoding_for_model,
  get_encoding,
  get_encoding_name_for_model,
  type TiktokenEncoding,
  type Tiktoken as TiktokenInstance,
  type TiktokenModel
} from 'tiktoken';

import type { Tokenizer } from './types.js';

/**
 * WASM-backed BPE tokenizer via the `tiktoken` package (fork of openai/tiktoken).
 *
 * Covers all OpenAI models and any model that uses cl100k_base / o200k_base
 * encoding. The encoder must be explicitly freed when no longer needed.
 */
export class TiktokenTokenizer implements Tokenizer {
  readonly name: string;

  private readonly enc: TiktokenInstance;

  private constructor(name: string, enc: TiktokenInstance) {
    this.name = name;
    this.enc = enc;
  }

  // ── Factory methods ────────────────────────────────────────────────

  /** Create from an encoding name (e.g. "cl100k_base", "o200k_base"). */
  static fromEncoding(encoding: TiktokenEncoding): TiktokenTokenizer {
    const enc = get_encoding(encoding);
    return new TiktokenTokenizer(encoding, enc);
  }

  /** Create from an OpenAI model name (e.g. "gpt-4", "gpt-3.5-turbo"). */
  static fromModel(model: TiktokenModel): TiktokenTokenizer {
    const enc = encoding_for_model(model);
    return new TiktokenTokenizer(model, enc);
  }

  // ── Tokenizer implementation ───────────────────────────────────────

  count(text: string): number {
    return this.enc.encode_ordinary(text).length;
  }

  encode(text: string): Uint32Array {
    return this.enc.encode_ordinary(text);
  }

  decode(tokens: Uint32Array | number[]): string {
    const u32 = tokens instanceof Uint32Array ? tokens : Uint32Array.from(tokens);
    const bytes = this.enc.decode(u32);
    return new TextDecoder().decode(bytes);
  }

  free(): void {
    this.enc.free();
  }
}

/**
 * Lazily-instantiated, pooled wrapper around TiktokenTokenizer.
 *
 * Multiple calls to the same encoding return the **same** instance,
 * which must be freed only once via the pool's `freeAll()` method.
 */
export class TiktokenPool {
  private readonly cache = new Map<string, TiktokenTokenizer>();

  /** Get or create a tokenizer for the given encoding. */
  get(encoding: TiktokenEncoding): TiktokenTokenizer {
    const existing = this.cache.get(encoding);
    if (existing !== undefined) {
      return existing;
    }
    const tokenizer = TiktokenTokenizer.fromEncoding(encoding);
    this.cache.set(encoding, tokenizer);
    return tokenizer;
  }

  /** Get or create a tokenizer for an OpenAI model. */
  getForModel(model: TiktokenModel): TiktokenTokenizer {
    const encName = get_encoding_name_for_model(model);
    return this.get(encName);
  }

  /** Release all cached tokenizers. Call once at shutdown. */
  freeAll(): void {
    for (const t of this.cache.values()) {
      t.free();
    }
    this.cache.clear();
  }
}
