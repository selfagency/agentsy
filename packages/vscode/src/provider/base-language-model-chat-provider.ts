import { errorCodeToMessage, errorToProviderCode } from '../error-handling/error-mapper.js';
import { convertMessages, type ChatMessage } from '../message-conversion/index.js';
import type { ProviderApiRequest, ProviderConfig, ProviderStreamChunk } from '../types/errors.js';

/**
 * Empty async generator for error responses.
 */
async function* emptyStream(): AsyncIterable<LanguageModelChatResponseChunk> {
  // Empty stream - yields nothing
}

/**
 * Minimal duck-typed interfaces to avoid hard vscode import.
 * These match the shapes used by VS Code's LanguageModelChatProvider.
 */
export interface LanguageModelChatRequest {
  messages: unknown[];
  tools?: unknown[];
  toolMode?: unknown;
  justification?: string;
  model?: { id: string; [key: string]: unknown };
  options?: {
    temperature?: number;
    stopSequences?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: (handler: () => void) => { dispose(): void };
}

export interface LanguageModelChatResponseChunk {
  part: unknown;
}

export interface LanguageModelChatResponse {
  stream: AsyncIterable<LanguageModelChatResponseChunk>;
  text: Thenable<string>;
}

export interface ExtensionContext {
  secrets: {
    get(key: string): Thenable<string | undefined>;
    store(key: string, value: string): Thenable<void>;
    delete(key: string): Thenable<void>;
  };
  [key: string]: unknown;
}

/**
 * Abstract base class for all VS Code LanguageModelChatProvider implementations.
 * Subclasses must implement buildRequest, normalizeStream, and mapErrorToCode.
 */
export abstract class BaseLanguageModelChatProvider {
  constructor(
    protected readonly context: ExtensionContext,
    protected readonly config: ProviderConfig,
  ) {}

  get id(): string {
    return this.config.providerId;
  }

  get vendor(): string {
    return this.config.vendor;
  }

  get family(): string {
    return this.config.family;
  }

  get name(): string {
    return this.config.displayName;
  }

  get maxInputTokens(): number {
    return this.config.maxInputTokens;
  }

  async countTokens(text: string, _model: string): Promise<number> {
    // Simple approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  async makeRequest(
    request: LanguageModelChatRequest,
    token: CancellationToken,
  ): Promise<LanguageModelChatResponse> {
    if (token.isCancellationRequested) {
      return this.createErrorResponse(new Error('Cancelled'), 'Request was cancelled.');
    }

    let abortController: AbortController | undefined;
    try {
      abortController = new AbortController();
      const onCancel = token.onCancellationRequested(() => abortController?.abort());

      const messages = convertMessages(request.messages);
      const providerRequest = await this.buildRequest(messages, request);

      const rawStream = await this.streamChat({ ...providerRequest, signal: abortController.signal }, token);
      const normalizedStream = this.normalizeStream(rawStream);

      let fullText = '';
      const chunks: LanguageModelChatResponseChunk[] = [];

      const collectStream = async (): Promise<void> => {
        for await (const chunk of normalizedStream) {
          chunks.push(chunk);
          if (chunk.part && typeof chunk.part === 'object') {
            const p = chunk.part as Record<string, unknown>;
            if (typeof p.value === 'string') fullText += String(p.value);
          }
        }
        onCancel.dispose();
      };

      const streamPromise = collectStream();

      const generateStream = async function* (): AsyncIterable<LanguageModelChatResponseChunk> {
        await streamPromise;
        yield* chunks;
      };

      return {
        stream: generateStream(),
        text: streamPromise.then(() => fullText),
      };
    } catch (error) {
      abortController?.abort();
      return this.createErrorResponse(error, errorCodeToMessage(errorToProviderCode(error)));
    }
  }

  /**
   * Performs the HTTP streaming request to the provider API.
   * Uses the signal from the request for cancellation.
   */
  protected async streamChat(
    request: ProviderApiRequest & { signal?: AbortSignal },
    _token: CancellationToken,
  ): Promise<AsyncIterable<ProviderStreamChunk>> {
    const { url, method, headers, body, signal } = request;
    if (!url) throw new Error('Provider API request URL is required');

    const response = await fetch(url, {
      method: method ?? 'POST',
      headers: headers as HeadersInit,
      body: body !== undefined ? JSON.stringify(body) : null,
      ...(signal && { signal }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(`HTTP ${response.status}: ${text}`) as Error & { status: number };
      err.status = response.status;
      throw err;
    }

    const responseBody = response.body;
    if (responseBody === null) {
      throw new Error('No response body from provider');
    }

    return (async function* (): AsyncIterable<ProviderStreamChunk> {
      const reader = responseBody.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
            try {
              yield JSON.parse(data) as ProviderStreamChunk;
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }

  protected createErrorResponse(error: unknown, userMessage: string): LanguageModelChatResponse {
    const msg = userMessage || errorCodeToMessage(errorToProviderCode(error));

    return {
      stream: emptyStream(),
      text: Promise.resolve(msg),
    };
  }

  /**
   * Convert VS Code messages and request options to provider-specific API format.
   */
  protected abstract buildRequest(
    messages: ChatMessage[],
    request: LanguageModelChatRequest,
  ): Promise<ProviderApiRequest>;

  /**
   * Normalize raw provider stream chunks into VS Code LanguageModelChatResponseChunks.
   */
  protected abstract normalizeStream(
    response: AsyncIterable<ProviderStreamChunk>,
  ): AsyncIterable<LanguageModelChatResponseChunk>;

  /**
   * Map provider-specific errors to ProviderErrorCode values.
   */
  protected abstract mapErrorToCode(error: unknown): string;
}
