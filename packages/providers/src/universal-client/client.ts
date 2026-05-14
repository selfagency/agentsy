/**
 * @agentsy/providers/universal-client
 *
 * Unified client abstractions for provider integration.
 */

import type {
  CompletionRequest,
  CompletionResponse,
  NormalizedChunk,
} from '@agentsy/types';
import type { ReadableStream } from 'node:stream/web';
import {
  normalizeAnthropicEvent,
  normalizeBedrockConverseEvent,
  normalizeCohereEvent,
  normalizeGeminiChunk,
  normalizeHuggingFaceTGIChunk,
  normalizeMistralChunk,
  normalizeOllamaChatChunk,
  normalizeOpenAIChatChunk,
  normalizeZAiChunk,
} from '../normalizers/index.js';
import { createPipeline, type PipelineOptions, type NormalizerProvider } from '../pipeline/index.js';

/**
 * Configuration options for a UniversalClient instance.
 */
export interface UniversalClientConfig {
  /** Provider identifier (e.g., 'openai', 'anthropic', 'gemini') */
  provider: NormalizerProvider;
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for provider API (defaults to provider-specific URL) */
  baseUrl?: string;
  /** Organization ID for OpenAI-compatible providers */
  organizationId?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Retry policy for network errors */
  retryPolicy?: 'exponential' | 'linear' | 'none';
  /** Initial delay between retries in milliseconds */
  initialDelayMs?: number;
}

/**
 * A unified client that automatically routes requests to the correct provider-specific adapter and normalizer.
 *
 * Designed to abstract away provider differences while providing full access to streaming capabilities.
 *
 * @example
 * ```typescript
 * const client = createUniversalClient({
 *   provider: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * const response = await client.complete({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export interface UniversalClient {
  /**
   * Executes a non-streaming completion request and returns the complete response.
   *
   * @param request - The completion request with model, messages, tools, and other parameters
   * @returns A Promise that resolves to the completion response
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Executes a streaming completion request and returns a ReadableStream of normalized chunks.
   *
   * @param request - The completion request with model, messages, tools, and other parameters
   * @returns A Promise that resolves to a ReadableStream of NormalizedChunk objects
   */
  stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>>;
}

/**
 * Creates a UniversalClient instance configured for a specific provider.
 *
 * @param config - Configuration options including provider, apiKey, baseUrl, and retry settings
 * @returns A new UniversalClient instance
 */
export function createUniversalClient(config: UniversalClientConfig): UniversalClient {
  const { provider } = config;

  return {
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      throw new Error(
        'complete() is not yet implemented. For now, use stream() with an SSE stream. ' +
        'See packages/providers/README.md for current streaming usage patterns.'
      );
    },

    async stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      // TODO: perform HTTP fetch to provider API using request and config
      // For now, this requires the user to provide their own SSE stream
      throw new Error(
        'stream() requires an SSE stream, which currently needs to be provided by the caller. ' +
        'The automatic fetch layer is not yet implemented. ' +
        'Use createPipeline directly for now, or provide your own SSE stream.'
      );
      /*
      // Future implementation will:
      // 1. Convert CompletionRequest to provider-specific format using adapters (toMistralMessages, etc.)
      // 2. Determine correct endpoint URL based on provider and model
      // 3. Execute HTTPS fetch with proper headers and body
      // 4. Pipe response through SSE → Normalizer → Processor pipeline
      // 5. Return normalized chunk stream

      const pipeline = createPipeline(sseStream, {
        provider,
        maxJsonDepth: 64,
        maxJsonKeys: 10000,
        // options from CompletionRequest
        ...extractProcessorOptions(request),
      });

      // Convert PipelineEvents to NormalizedChunks
      return convertPipelineToChunks(pipeline) as ReadableStream<NormalizedChunk>;
      */
    },
  };
}

/**
 * Extracts ProcessorOptions from a CompletionRequest for use in createPipeline.
 */
function extractProcessorOptions(request: CompletionRequest): Partial<PipelineOptions> {
  return {
    // TODO: map fields from CompletionRequest to ProcessorOptions
    // - knownTools → knownTools Set
    // - parseThinkTags → parseThinkTags boolean
    // - modelId → modelId string
    // - scrubContextTags → scrubContextTags boolean
    // - maxRecursionDepth → maxRecursionDepth number
    // - maxJsonDepth → maxJsonDepth number
    // - maxJsonKeys → maxJsonKeys number
  };
}