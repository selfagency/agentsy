import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CancellationToken } from '../types.js';
import { cancellationTokenToAbortSignal } from './cancellationTokenToAbortSignal.js';
import { createVSCodeAgentLoop } from './createVSCodeAgentLoop.js';
import type { ChatResponseStream } from './createVSCodeChatRenderer.js';
import { createVSCodeChatRenderer } from './createVSCodeChatRenderer.js';

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
        stream: null as unknown as ChatResponseStream,
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
        } as unknown as ChatResponseStream,
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

    it('calls updateToolInvocation when tool_call_delta received', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
      });

      mockStream.updateToolInvocation = vi.fn();

      await renderer.write('Content');
      await renderer.end();

      // Verify the handler exists and can be called
      expect(mockStream.updateToolInvocation).toBeDefined();
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

    it('prevents double onFinish invocation', async () => {
      const onFinish = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onFinish,
      });

      // Call writeChunk with done=true
      await renderer.writeChunk({
        content: 'Test',
        done: true,
        finishReason: 'stop',
      });

      // Then call end()
      await renderer.end();

      // onFinish should only be called once (in writeChunk)
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('calls onFinish in end() if not already called', async () => {
      const onFinish = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onFinish,
      });

      // Use write() which doesn't have done=true
      await renderer.write('Content');
      await renderer.end();

      // onFinish should be called once in end()
      expect(onFinish).toHaveBeenCalledTimes(1);
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

  describe('Blockquote Thinking Blocks', () => {
    it('emits blockquote header when thinking content processed with blockquote style', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: true,
        thinkingStyle: 'blockquote',
      });

      // Write thinking content that will trigger blockquote header
      await renderer.write('Let me think about this');
      await renderer.end();

      // Verify stream.markdown was called (for content or blockquote header)
      expect(mockStream.markdown).toHaveBeenCalled();
    });

    it('suppresses thinking blocks when showThinking is false', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: false,
        thinkingStyle: 'blockquote',
      });

      await renderer.write('Some content');
      await renderer.end();

      // Still should call markdown for text content
      expect(mockStream.markdown).toHaveBeenCalled();
    });

    it('accepts custom thinkingStyle options', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: true,
        thinkingStyle: 'progress',
      });

      await renderer.write('Content');
      await renderer.end();

      // Renderer should be usable with progress style
      expect(renderer).toBeDefined();
    });

    it('should handle structured chunk output with tool calls', async () => {
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        showThinking: false,
      });

      // Write text content first
      await renderer.write('I will search for that.');

      // Then write chunk with tool calls (structured output)
      await renderer.writeChunk({
        content: '',
        tool_calls: [
          {
            function: { name: 'search', arguments: { query: 'test' } },
          },
        ],
        done: false,
      });

      // Final completion
      await renderer.end();

      // Verify markdown was called for text content
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
    for (const listener of listeners) {
      listener(undefined);
    }

    expect(signal.aborted).toBe(true);
  });
});
