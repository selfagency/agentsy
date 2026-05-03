import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../message-conversion/index.js';
import type { ProviderApiRequest, ProviderStreamChunk } from '../types/errors.js';
import {
  BaseLanguageModelChatProvider,
  type CancellationToken,
  type LanguageModelChatRequest,
  type LanguageModelChatResponseChunk,
} from './base-language-model-chat-provider.js';

function makeCancellationToken(cancelled = false): CancellationToken {
  return {
    isCancellationRequested: cancelled,
    onCancellationRequested: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function makeExtensionContext() {
  return {
    secrets: {
      get: vi.fn().mockResolvedValue(undefined),
      store: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const config = {
  providerId: 'test-provider',
  vendor: 'Test',
  family: 'TestFamily',
  displayName: 'Test Provider',
  maxInputTokens: 4096,
};

class TestProvider extends BaseLanguageModelChatProvider {
  public builtRequest: ProviderApiRequest | undefined;
  public streamChunks: ProviderStreamChunk[] = [];
  public errorCode = 'internal_error';

  protected async buildRequest(
    messages: ChatMessage[],
    request: LanguageModelChatRequest,
  ): Promise<ProviderApiRequest> {
    this.builtRequest = {
      url: 'http://localhost:11434/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { messages, model: request.model?.id ?? 'test' },
    };
    return this.builtRequest;
  }

  protected normalizeStream(
    response: AsyncIterable<ProviderStreamChunk>,
  ): AsyncIterable<LanguageModelChatResponseChunk> {
    const pushChunk = (chunk: ProviderStreamChunk): void => {
      this.streamChunks.push(chunk);
    };

    // biome-ignore lint/correctness/useQwikValidLexicalScope: false positive from linter
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
  protected async streamChat(
    _request: ProviderApiRequest & { signal?: AbortSignal },
    _token: CancellationToken,
  ): Promise<AsyncIterable<ProviderStreamChunk>> {
    const chunks = this.streamChunks;
    const mockChunks = chunks.length > 0 ? [...chunks] : [{ content: 'Hello' }];
    return (async function* () {
      for (const c of mockChunks) yield c;
    })();
  }
}

describe('BaseLanguageModelChatProvider', () => {
  describe('getters', () => {
    const ctx = makeExtensionContext();
    const provider = new TestProvider(ctx, config);

    it('id', () => expect(provider.id).toBe('test-provider'));
    it('vendor', () => expect(provider.vendor).toBe('Test'));
    it('family', () => expect(provider.family).toBe('TestFamily'));
    it('name', () => expect(provider.name).toBe('Test Provider'));
    it('maxInputTokens', () => expect(provider.maxInputTokens).toBe(4096));
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
        messages: [{ role: 1, content: 'Hello' }],
        model: { id: 'my-model' },
      };
      const token = makeCancellationToken();
      await provider.makeRequest(request, token);
      expect(provider.builtRequest).toBeDefined();
      if (!provider.builtRequest) throw new Error('builtRequest should be defined');
      const body = provider.builtRequest.body as { messages: ChatMessage[]; model: string };
      expect(body.messages[0].content).toBe('Hello');
      expect(body.model).toBe('my-model');
    });

    it('streams normalized chunks', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const request: LanguageModelChatRequest = { messages: [{ role: 1, content: 'Hi' }] };
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
        protected async buildRequest(): Promise<ProviderApiRequest> {
          throw new Error('API error');
        }
      }
      const provider = new FailingProvider(makeExtensionContext(), config);
      const token = makeCancellationToken();
      const response = await provider.makeRequest({ messages: [] }, token);
      const text = await response.text;
      expect(typeof text).toBe('string');
    });
  });

  describe('createErrorResponse', () => {
    it('produces empty stream', async () => {
      const provider = new TestProvider(makeExtensionContext(), config);
      const response = (
        provider as unknown as { createErrorResponse(e: unknown, m: string): ReturnType<TestProvider['makeRequest']> }
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
        provider as unknown as { createErrorResponse(e: unknown, m: string): ReturnType<TestProvider['makeRequest']> }
      ).createErrorResponse(new Error('test'), 'User-facing message');
      const text = await response.text;
      expect(text).toBe('User-facing message');
    });
  });
});
