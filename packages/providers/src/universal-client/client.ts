/**
 * @agentsy/providers/universal-client
 *
 * Unified client abstractions for provider integration.
 */

import type { CompletionRequest, CompletionResponse, NormalizedChunk, UsageInfo } from '@agentsy/types';
import { ReadableStream } from 'node:stream/web';
import { createPipeline, type NormalizerProvider } from '../pipeline/index.js';

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
 * Provider endpoint URLs.
 */
const PROVIDER_ENDPOINTS: Record<NormalizerProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  bedrock: 'https://bedrock-runtime.amazonaws.com',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  ollama: 'http://localhost:11434/api/chat',
  cohere: 'https://api.cohere.com/v1/chat',
  'hugging-face': 'https://api-inference.huggingface.co/models',
  zai: 'https://api.zai.com/v1/chat',
};

/**
 * Convert CompletionRequest to provider-specific request format.
 */
function toProviderRequest(request: CompletionRequest, provider: NormalizerProvider): Record<string, unknown> {
  switch (provider) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
    case 'mistral':
    case 'ollama':
    case 'cohere':
    case 'zai':
      return toOpenAIFormat(request);
    case 'bedrock':
      return toBedrockFormat(request);
    case 'hugging-face':
      return toHuggingFaceFormat(request);
    default:
      return toOpenAIFormat(request);
  }
}

/**
 * Convert CompletionRequest to OpenAI-compatible format.
 */
function toOpenAIFormat(request: CompletionRequest): Record<string, unknown> {
  const req: Record<string, unknown> = {
    model: request.model,
    messages: request.messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content)
        ? msg.content.map(part => {
            if (part.type === 'text') return part.text;
            if (part.type === 'image')
              return {
                type: 'image_url',
                image_url: {
                  url: part.imageUrl,
                  detail: part.detail ?? 'auto',
                },
              };
            if (part.type === 'tool_call')
              return {
                type: 'tool_calls' as const,
                tool_calls: [
                  {
                    id: part.id,
                    type: 'function' as const,
                    function: {
                      name: part.name,
                      arguments: JSON.stringify(part.input),
                    },
                  },
                ],
              };
            if (part.type === 'tool_result')
              return {
                type: 'tool_result' as const,
                tool_call_id: part.toolCallId,
                content: part.content,
              };
            return part;
          })
        : msg.content,
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
    })),
  };

  if (request.temperature !== undefined) req.temperature = request.temperature;
  if (request.maxTokens !== undefined) req.max_tokens = request.maxTokens;
  if (request.topP !== undefined) req.top_p = request.topP;
  if (request.topK !== undefined) req.top_k = request.topK;
  if (request.stop) req.stop = request.stop;
  if (request.stream !== undefined) req.stream = request.stream;
  if (request.tools) req.tools = request.tools;

  return req;
}

/**
 * Convert CompletionRequest to Bedrock format.
 */
function toBedrockFormat(request: CompletionRequest): Record<string, unknown> {
  // Bedrock uses a different format
  return {
    modelId: request.model,
    messages: request.messages,
    maxTokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
  };
}

/**
 * Convert CompletionRequest to HuggingFace text generation format.
 */
function toHuggingFaceFormat(request: CompletionRequest): Record<string, unknown> {
  return {
    model: request.model,
    inputs: request.messages,
    parameters: {
      max_new_tokens: request.maxTokens,
      temperature: request.temperature,
      do_sample: request.temperature !== undefined,
      top_p: request.topP,
      top_k: request.topK,
    },
  };
}

function parseUsageInfo(usageData: Record<string, unknown>): UsageInfo | undefined {
  const usage: UsageInfo = {};
  if (typeof usageData.inputTokens === 'number') {
    usage.inputTokens = usageData.inputTokens;
  }
  if (typeof usageData.outputTokens === 'number') {
    usage.outputTokens = usageData.outputTokens;
  }
  if (typeof usageData.totalTokens === 'number') {
    usage.totalTokens = usageData.totalTokens;
  }
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function parseContentFromChoice(
  content: { content: string } | { content?: { parts?: Array<{ text?: string }> } },
): string {
  if (typeof content.content === 'string') {
    return content.content;
  }
  return content.content?.parts?.map(p => p.text).join('') ?? '';
}

function parseProviderResponse(response: unknown, _provider: NormalizerProvider): CompletionResponse {
  const data = response as Record<string, unknown>;

  if (!('choices' in data) || !Array.isArray(data.choices) || data.choices.length === 0) {
    return {
      content: typeof data.content === 'string' ? data.content : JSON.stringify(data),
    };
  }

  const choice = data.choices[0] as Record<string, unknown>;
  const content = choice.message as { content: string } | { content?: { parts?: Array<{ text?: string }> } };

  const usage: UsageInfo | undefined =
    data.usage && typeof data.usage === 'object' ? parseUsageInfo(data.usage as Record<string, unknown>) : undefined;

  const result: CompletionResponse = {
    content: parseContentFromChoice(content),
  };

  if (usage) {
    result.usage = usage;
  }

  if (data.model && typeof data.model === 'string') {
    result.model = data.model;
  }

  if (data.id && typeof data.id === 'string') {
    result.id = data.id;
  }

  return result;
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
  const { provider, apiKey, baseUrl } = config;
  const endpoint = baseUrl ?? PROVIDER_ENDPOINTS[provider];

  return {
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      const providerRequest = toProviderRequest(request, provider);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: buildHeaders(provider, apiKey, config.organizationId),
        body: JSON.stringify(providerRequest),
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : null,
      });

      if (!response.ok) {
        throw new Error(`Provider request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return parseProviderResponse(data, provider);
    },

    async stream(request: CompletionRequest): Promise<ReadableStream<NormalizedChunk>> {
      const providerRequest = toProviderRequest({ ...request, stream: true }, provider);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: buildHeaders(provider, apiKey, config.organizationId, true),
        body: JSON.stringify(providerRequest),
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : null,
      });

      if (!response.ok) {
        throw new Error(`Provider stream request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Provider stream response did not include a body');
      }

      const pipeline = createPipeline(response.body, {
        provider,
        maxJsonDepth: 64,
        maxJsonKeys: 10000,
      });

      const chunks: NormalizedChunk[] = [];
      for await (const event of pipeline) {
        if (event.type === 'delta' && event.content) {
          chunks.push({ content: event.content });
        } else if (event.type === 'tool_call' && event.tool_call) {
          chunks.push({
            tool_calls: [{ function: { name: event.tool_call.name, arguments: event.tool_call.parameters } }],
          });
        } else if (event.type === 'thinking' && event.thinking) {
          chunks.push({ thinking: event.thinking });
        }
      }

      const stream = new ReadableStream<NormalizedChunk>({
        async start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      return stream;
    },
  };
}

function buildHeaders(
  _provider: NormalizerProvider,
  apiKey?: string,
  organizationId?: string,
  stream?: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    switch (_provider) {
      case 'openai':
        headers.Authorization = `Bearer ${apiKey}`;
        if (organizationId) headers['OpenAI-Organization'] = organizationId;
        break;
      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        if (stream) headers['accept'] = 'text/event-stream';
        break;
      case 'gemini':
        headers.Authorization = `Bearer ${apiKey}`;
        break;
      default:
        headers.Authorization = `Bearer ${apiKey}`;
    }
  }

  return headers;
}
