import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { ChatMessage } from '../message-conversion/index.js';
import type { ProviderApiRequest, ProviderStreamChunk } from '../types/errors.js';
import type {
  CancellationToken,
  LanguageModelChatRequest,
  LanguageModelChatResponse,
  LanguageModelChatResponseChunk
} from './base-language-model-chat-provider.js';
import { BaseLanguageModelChatProvider } from './base-language-model-chat-provider.js';

function makeCancellationToken(cancelled = false): CancellationToken {
  return {
    isCancellationRequested: cancelled,
    onCancellationRequested: vi.fn().mockReturnValue({ dispose: vi.fn() })
  };
}

function makeExtensionContext() {
  return {
    secrets: {
      delete: vi.fn(),
      get: vi.fn(),
      store: vi.fn()
    }
  };
}

const config = {
  displayName: 'Test Provider',
  family: 'TestFamily',
  maxInputTokens: 4096,
  providerId: 'test-provider',
  vendor: 'Test'
};

class TestProvider extends BaseLanguageModelChatProvider {
  public builtRequest: ProviderApiRequest | undefined;
  public streamChunks: ProviderStreamChunk[] = [];
  public errorCode = 'internal_error';

  // biome-ignore lint/suspicious/useAwait: overrides abstract class method
  protected async buildRequest(
    messages: ChatMessage[],
    request: LanguageModelChatRequest
  ): Promise<ProviderApiRequest> {
    this.builtRequest = {
      body: { messages, model: request.model?.id ?? 'test' },
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      url: 'http://localhost:11434/api/chat'
    };
    return this.builtRequest;
  }

  protected normalizeStream(
    response: AsyncIterable<ProviderStreamChunk>
  ): AsyncIterable<LanguageModelChatResponseChunk> {
    const pushChunk = (chunk: ProviderStreamChunk): void => {
      this.streamChunks.push(chunk);
    };

    //
    return (async function* (): AsyncIterable<LanguageModelChatResponseChunk> {
      for await (const chunk of response) {
        pushChunk(chunk);
        const chunkRecord = chunk as Record<string, unknown>;
        yield { part: { value: (chunkRecord.content as string) ?? '' } };
      }
    })();
  }

  protected mapErrorToCode(_error: unknown): string {
    return this.errorCode;
  }

  // Override streamChat for unit testing (no real HTTP)
  // biome-ignore lint/suspicious/useAwait: overrides abstract class method
  protected async streamChat(
    _request: ProviderApiRequest & { signal?: AbortSignal },
    _token: CancellationToken
  ): Promise<AsyncIterable<ProviderStreamChunk>> {
    const chunks = this.streamChunks;
    const mockChunks = chunks.length > 0 ? [...chunks] : [{ content: 'Hello' }];
    // biome-ignore lint/suspicious/useAwait: async generator needed for AsyncIterable return type
    return (async function* () {
      for (const c of mockChunks) {
        yield c;
      }
    })();
  }
}

class RealStreamProvider extends BaseLanguageModelChatProvider {
  // biome-ignore lint/suspicious/useAwait: overrides abstract class method
  protected async buildRequest(
    messages: ChatMessage[],
    request: LanguageModelChatRequest
  ): Promise<ProviderApiRequest> {
    return {
      body: { messages, model: request.model?.id ?? 'test' },
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      url: 'http://localhost:11434/api/chat'
    };
  }

  protected normalizeStream(
    response: AsyncIterable<ProviderStreamChunk>
  ): AsyncIterable<LanguageModelChatResponseChunk> {
    return (async function* () {
      for await (const chunk of response) {
        yield { part: { value: (chunk as Record<string, unknown>).content as string } };
      }
    })();
  }

  protected mapErrorToCode(): string {
    return 'internal_error';
  }
}

describe(BaseLanguageModelChatProvider, () => {
  describe('getters', () => {
    const ctx = makeExtensionContext();
    const provider = new TestProvider(ctx, config);

    it('id', () => {
      expect(provider.id).toBe('test-provider');
    });
    it('vendor', () => {
      expect(provider.vendor).toBe('Test');
    });
    it('family', () => {
      expect(provider.family).toBe('TestFamily');
    });
    it('name', () => {
      expect(provider.name).toBe('Test Provider');
    });
    it('maxInputTokens', () => {
      expect(provider.maxInputTokens).toBe(4096);
    });
  });

  describe('countTokens', () => {
    it('approximates tokens as chars / 4', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const tokens = await provider.countTokens('abcdefgh', 'test');
      expect(tokens).toBe(2);
    });

    it('rounds up', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const tokens = await provider.countTokens('abc', 'test');
      expect(tokens).toBe(1);
    });
  });

  describe('makeRequest', () => {
    it('returns cancelled response when token is already cancelled', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const request: LanguageModelChatRequest = { messages: [] };
      const token = makeCancellationToken(true);
      const response = await provider.makeRequest(request, token);
      const text = await response.text;
      expect(text).toContain('cancel');
    });

    it('converts messages and calls buildRequest', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const request: LanguageModelChatRequest = {
        messages: [{ content: 'Hello', role: 1 }],
        model: { id: 'my-model' }
      };
      const token = makeCancellationToken();
      await provider.makeRequest(request, token);
      expect(provider.builtRequest).toBeDefined();
      if (!provider.builtRequest) {
        throw new Error('builtRequest should be defined');
      }
      const body = provider.builtRequest.body as {
        messages: ChatMessage[];
        model: string;
      };
      const firstMessage = body.messages[0];
      if (!firstMessage) {
        throw new Error('Expected at least one converted message');
      }
      expect(firstMessage.content).toBe('Hello');
      expect(body.model).toBe('my-model');
    });

    it('streams normalized chunks', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const request: LanguageModelChatRequest = {
        messages: [{ content: 'Hi', role: 1 }]
      };
      const token = makeCancellationToken();
      const response = await provider.makeRequest(request, token);
      const chunks: LanguageModelChatResponseChunk[] = [];
      for await (const chunk of response.stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('returns error response on exception', async () => {
      class FailingProvider extends TestProvider {
        // biome-ignore lint/suspicious/useAwait: overrides parent class method
        protected async buildRequest(): Promise<ProviderApiRequest> {
          throw new Error('API error');
        }
      }
      const provider = new FailingProvider(makeExtensionContext(), config);
      const token = makeCancellationToken();
      const response = await provider.makeRequest({ messages: [] }, token);
      const text = await response.text;
      expectTypeOf(text).toBeString();
    });
  });

  describe('createErrorResponse', () => {
    it('produces empty stream', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const response = (
        provider as unknown as {
          createErrorResponse(e: unknown, m: string): LanguageModelChatResponse;
        }
      ).createErrorResponse(new Error('test'), 'Something went wrong');
      const chunks: unknown[] = [];
      for await (const chunk of response.stream) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(0);
    });

    it('resolves text with provided message', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const response = (
        provider as unknown as {
          createErrorResponse(e: unknown, m: string): LanguageModelChatResponse;
        }
      ).createErrorResponse(new Error('test'), 'User-facing message');
      const text = await response.text;
      expect(text).toBe('User-facing message');
    });
  });

  describe('streamChat', () => {
    it('streams chunks from a successful HTTP response', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"content":"hello"}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
        status: 200,
        text: vi.fn()
      });

      const provider = new RealStreamProvider(makeExtensionContext(), config);
      const token = makeCancellationToken();
      const result = await provider.makeRequest({ messages: [] }, token);
      const chunks: LanguageModelChatResponseChunk[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('throws when URL is missing', async () => {
      globalThis.fetch = vi.fn();
      const provider = new RealStreamProvider(makeExtensionContext(), config);
      const token = makeCancellationToken();
      const req: ProviderApiRequest = { body: {}, headers: {}, method: 'POST' };
      await expect(
        (
          provider as unknown as {
            streamChat(r: typeof req, t: CancellationToken): Promise<unknown>;
          }
        ).streamChat(req, token)
      ).rejects.toThrow('Provider API request URL is required');
    });

    it('throws when response body is null', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: null,
        status: 200,
        text: vi.fn()
      });

      const provider = new RealStreamProvider(makeExtensionContext(), config);
      const token = makeCancellationToken();
      const req: ProviderApiRequest = { body: {}, headers: {}, method: 'POST', url: 'http://x' };
      await expect(
        (
          provider as unknown as {
            streamChat(r: typeof req, t: CancellationToken): Promise<unknown>;
          }
        ).streamChat(req, token)
      ).rejects.toThrow('HTTP response has no body');
    });

    it('throws on HTTP error response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server Error')
      });

      const provider = new RealStreamProvider(makeExtensionContext(), config);
      const token = makeCancellationToken();
      const req: ProviderApiRequest = { body: {}, headers: {}, method: 'POST', url: 'http://x' };
      await expect(
        (
          provider as unknown as {
            streamChat(r: typeof req, t: CancellationToken): Promise<unknown>;
          }
        ).streamChat(req, token)
      ).rejects.toThrow('HTTP 500: Server Error');
    });
  });
});
