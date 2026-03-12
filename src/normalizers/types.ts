import type { StreamChunk } from '../processor/LLMStreamProcessor.js';

/** Token usage information from an LLM provider response. */
export interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** A streaming delta for a native (JSON-format) tool call from a provider. */
export interface NativeToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
}

/** The result of normalizing a provider-specific streaming chunk into a canonical StreamChunk. */
export interface NormalizerResult {
  chunk: StreamChunk;
  usage?: UsageInfo;
  rawEvent?: unknown;
}
