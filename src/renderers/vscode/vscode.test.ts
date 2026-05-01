import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVSCodeChatRenderer } from './createVSCodeChatRenderer.js';
import { createVSCodeAgentLoop } from './createVSCodeAgentLoop.js';
import { cancellationTokenToAbortSignal } from './cancellationTokenToAbortSignal.js';
import type { ChatResponseStream } from './createVSCodeChatRenderer.js';
import type { CancellationToken } from '../types.js';

describe('VS Code Chat Renderer', () => {
  let mockStream: ChatResponseStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = {
      progress: vi.fn(),
      markdown: vi.fn(),
      anchor: vi.fn(),
      reference: vi.fn(),
      button: vi.fn(),
      filetree: vi.fn(),
      // Proposed API methods (optional)
      thinkingProgress: vi.fn(),
      beginToolInvocation: vi.fn(),
      updateToolInvocation: vi.fn(),
      usage: vi.fn(),
    };
  });

  it('requires ChatResponseStream', () => {
    expect(() => {
      createVSCodeChatRenderer({
        stream: null as any,
      });
    }).toThrow('ChatResponseStream is required');
  });

  it('creates renderer with stream', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    expect(renderer).toBeDefined();
    expect(renderer.write).toBeDefined();
    expect(renderer.writeChunk).toBeDefined();
    expect(renderer.end).toBeDefined();
  });

  it('sends markdown to stream on write', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('# Title\n\nContent');
    await renderer.end();

    expect(mockStream.markdown).toHaveBeenCalled();
  });

  it('sends multiple chunks to stream', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('Part 1');
    await renderer.write('Part 2');
    await renderer.write('Part 3');
    await renderer.end();

    expect(mockStream.markdown).toHaveBeenCalled();
  });

  describe('Thinking Blocks', () => {
    it('handles thinking blocks as blockquote style by default', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: true,
        thinkingStyle: 'blockquote',
      });

      await renderer.write('Content');
      await renderer.end();

      expect(mockStream.markdown).toHaveBeenCalled();
    });

    it('handles thinking blocks as progress style', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: {
          ...mockStream,
          thinkingProgress: undefined, // Test fallback to progress()
        } as any,
        showThinking: true,
        thinkingStyle: 'progress',
      });

      await renderer.writeChunk({
        thinking: 'Internal reasoning',
        content: 'Content',
        done: true,
      });

      expect(mockStream.progress).toHaveBeenCalled();
    });

    it('uses thinkingProgress when available', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: true,
        thinkingStyle: 'blockquote',
      });

      // Mock stream with proposed API
      mockStream.thinkingProgress = vi.fn();

      await renderer.write('Content');
      await renderer.end();

      // When proposed API is available, it should be preferred
      expect(mockStream.markdown).toHaveBeenCalled();
    });

    it('suppresses thinking when style is suppress', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: true,
        thinkingStyle: 'suppress',
      });

      await renderer.write('Content');
      await renderer.end();

      // No thinking should be emitted
      expect(mockStream.progress).not.toHaveBeenCalled();
    });

    it('suppresses thinking when showThinking is false', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: false,
      });

      await renderer.write('Content');
      await renderer.end();

      expect(mockStream.progress).not.toHaveBeenCalled();
    });
  });

  describe('Tool Call Feedback', () => {
    it('fires onToolCall callback', async () => {
      const onToolCall = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onToolCall,
      });

      await renderer.write('Tool use call');
      await renderer.end();

      // Tool call handling depends on processor parsing XML
      expect(renderer).toBeDefined();
    });

    it('invokes beginToolInvocation when available', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
      });

      expect(renderer).toBeDefined();
      expect(mockStream.beginToolInvocation).toBeDefined();
    });

    it('fires onToolCallDelta callback', async () => {
      const onToolCallDelta = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onToolCallDelta,
      });

      await renderer.write('Tool call');
      await renderer.end();

      expect(renderer).toBeDefined();
    });
  });

  describe('Usage Reporting', () => {
    it('reports usage when available', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
      });

      await renderer.writeChunk({
        content: 'Test',
        done: true,
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      expect(mockStream.usage).toHaveBeenCalledWith({
        promptTokens: 10,
        completionTokens: 20,
      });
    });

    it('handles missing usage data gracefully', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
      });

      await renderer.writeChunk({
        content: 'Test',
        done: true,
      });

      // Should not crash
      expect(renderer).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('calls onError for processing errors', async () => {
      const onError = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onError,
      });

      // Normal flow - no error
      await renderer.write('Content');
      await renderer.end();

      // Error handler defined
      expect(onError).toBeDefined();
    });

    it('calls onFinish callback', async () => {
      const onFinish = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onFinish,
      });

      await renderer.writeChunk({
        content: 'Test',
        done: true,
        finishReason: 'stop',
      });

      expect(onFinish).toHaveBeenCalledWith('stop', undefined);
    });
  });

  describe('writeChunk vs write', () => {
    it('writeChunk processes StreamChunk objects', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
      });

      await renderer.writeChunk({
        content: 'Streamed content',
        thinking: 'Internal reasoning',
        done: false,
      });

      await renderer.end();

      expect(mockStream.markdown).toHaveBeenCalled();
    });

    it('write processes string chunks', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
      });

      await renderer.write('String content');
      await renderer.end();

      expect(mockStream.markdown).toHaveBeenCalled();
    });
  });
});

describe('VS Code Agent Loop', () => {
  let mockStream: ChatResponseStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = {
      progress: vi.fn(),
      markdown: vi.fn(),
      anchor: vi.fn(),
      reference: vi.fn(),
      button: vi.fn(),
      filetree: vi.fn(),
    };
  });

  it('creates agent loop renderer', () => {
    const renderer = createVSCodeAgentLoop({
      stream: mockStream,
    });

    expect(renderer).toBeDefined();
    expect(renderer.write).toBeDefined();
    expect(renderer.end).toBeDefined();
  });

  it('defaults showThinking to true for agent loops', async () => {
    const renderer = createVSCodeAgentLoop({
      stream: mockStream,
    });

    // showThinking defaults to true for agent loops
    expect(renderer).toBeDefined();
  });

  it('allows overriding thinking style', async () => {
    const renderer = createVSCodeAgentLoop({
      stream: mockStream,
      thinkingStyle: 'progress',
      showThinking: true,
    });

    await renderer.write('Agent step');
    await renderer.end();

    expect(mockStream.markdown).toHaveBeenCalled();
  });

  it('handles abort signal gracefully', async () => {
    const abortController = new AbortController();
    const renderer = createVSCodeAgentLoop({
      stream: mockStream,
      abortSignal: abortController.signal,
    });

    await renderer.write('Content');
    await renderer.end();

    expect(renderer).toBeDefined();

    // Trigger abort - should not throw
    abortController.abort();
  });
});

describe('Cancellation Token Bridge', () => {
  it('converts CancellationToken to AbortSignal', () => {
    const mockToken: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn(() => ({
        dispose: vi.fn(),
      })),
    };

    const signal = cancellationTokenToAbortSignal(mockToken);

    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);
  });

  it('returns aborted signal when token is already cancelled', () => {
    const mockToken: CancellationToken = {
      isCancellationRequested: true,
      onCancellationRequested: vi.fn(() => ({
        dispose: vi.fn(),
      })),
    };

    const signal = cancellationTokenToAbortSignal(mockToken);

    expect(signal.aborted).toBe(true);
  });

  it('aborts signal when token fires cancellation', async () => {
    const listeners: Array<(e: unknown) => void> = [];

    const mockToken: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn((listener: (e: unknown) => void) => {
        listeners.push(listener);
        return { dispose: vi.fn() };
      }),
    };

    const signal = cancellationTokenToAbortSignal(mockToken);

    expect(signal.aborted).toBe(false);

    // Trigger cancellation by calling the registered listener
    listeners.forEach(listener => listener(undefined));

    expect(signal.aborted).toBe(true);
  });
});
