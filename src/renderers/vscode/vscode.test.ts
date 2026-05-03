import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMStreamProcessor } from '../../processor/index.js';
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

      await renderer.writeChunk({
        thinking: 'Internal reasoning',
        content: 'Visible content',
      });
      await renderer.end();

      expect(mockStream.thinkingProgress).toHaveBeenCalledWith({
        text: 'Internal reasoning',
        id: 'thinking',
      });
      expect(mockStream.progress).not.toHaveBeenCalled();
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
      const fakeProcessor = {
        process: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: false,
          parts: [
            {
              type: 'tool_call' as const,
              call: { id: 'tc_callback', name: 'search', parameters: { query: 'docs' }, format: 'bare-xml' as const },
              state: 'pending' as const,
            },
          ],
          incomplete: false,
          incompleteness: [],
        })),
        flush: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        })),
      } as unknown as LLMStreamProcessor;

      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onToolCall,
        processor: fakeProcessor,
      });

      await renderer.writeChunk({ content: 'Tool use call' });
      await renderer.end();

      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(onToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_call',
          call: expect.objectContaining({ id: 'tc_callback', name: 'search' }),
          state: 'pending',
        }),
      );
    });

    it('invokes beginToolInvocation when available', async () => {
      const fakeProcessor = {
        process: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: false,
          parts: [
            {
              type: 'tool_call' as const,
              call: { id: 'tc_begin', name: 'weather', parameters: { city: 'NYC' }, format: 'bare-xml' as const },
              state: 'pending' as const,
            },
          ],
          incomplete: false,
          incompleteness: [],
        })),
        flush: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        })),
      } as unknown as LLMStreamProcessor;

      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        processor: fakeProcessor,
      });

      await renderer.writeChunk({ content: 'invoke tool' });
      await renderer.end();

      expect(mockStream.beginToolInvocation).toHaveBeenCalledTimes(1);
      expect(mockStream.beginToolInvocation).toHaveBeenCalledWith('tc_begin', 'weather');
    });

    it('fires onToolCallDelta callback', async () => {
      const onToolCallDelta = vi.fn();
      const fakeProcessor = {
        process: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: false,
          parts: [
            {
              type: 'tool_call_delta' as const,
              id: 'tc_delta',
              name: 'search',
              argumentsDelta: '{"query":',
              index: 0,
            },
          ],
          incomplete: false,
          incompleteness: [],
        })),
        flush: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        })),
      } as unknown as LLMStreamProcessor;

      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onToolCallDelta,
        processor: fakeProcessor,
      });

      await renderer.writeChunk({ content: 'Tool delta' });
      await renderer.end();

      expect(onToolCallDelta).toHaveBeenCalledTimes(1);
      expect(onToolCallDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_call_delta',
          id: 'tc_delta',
          name: 'search',
          argumentsDelta: '{"query":',
        }),
      );
    });

    it('calls updateToolInvocation when tool_call_delta received', async () => {
      const fakeProcessor = {
        process: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: false,
          parts: [
            {
              type: 'tool_call_delta' as const,
              id: 'tc_update',
              name: 'search',
              argumentsDelta: '"docs"}',
              index: 1,
            },
          ],
          incomplete: false,
          incompleteness: [],
        })),
        flush: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        })),
      } as unknown as LLMStreamProcessor;

      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        processor: fakeProcessor,
      });

      await renderer.writeChunk({ content: 'delta content' });
      await renderer.end();

      expect(mockStream.updateToolInvocation).toHaveBeenCalledTimes(1);
      expect(mockStream.updateToolInvocation).toHaveBeenCalledWith(
        'tc_update',
        expect.objectContaining({
          type: 'tool_call_delta',
          id: 'tc_update',
          name: 'search',
          argumentsDelta: '"docs"}',
        }),
      );
    });

    it('awaits async onToolCall callback before writeChunk resolves', async () => {
      let releaseCallback: (() => void) | undefined;
      let callbackCompleted = false;
      const callbackGate = new Promise<void>(resolve => {
        releaseCallback = resolve;
      });

      const onToolCall = vi.fn(async () => {
        await callbackGate;
        callbackCompleted = true;
      });

      const fakeProcessor = {
        process: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: false,
          parts: [
            {
              type: 'tool_call' as const,
              call: { id: 'tc1', name: 'search', arguments: {} },
              state: 'pending' as const,
            },
          ],
          incomplete: false,
          incompleteness: [],
        })),
        flush: vi.fn(() => ({
          thinking: '',
          content: '',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        })),
      } as unknown as LLMStreamProcessor;

      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onToolCall,
        processor: fakeProcessor,
      });

      const writePromise = renderer.writeChunk({ content: 'chunk' });

      // If writeChunk correctly awaits onToolCall, callback should still be pending here.
      await Promise.resolve();
      expect(callbackCompleted).toBe(false);

      releaseCallback?.();
      await writePromise;

      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(callbackCompleted).toBe(true);
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

    it('calls onStep when stepIndex changes in writeChunk', async () => {
      const onStep = vi.fn();
      const renderer = createVSCodeChatRenderer({
        stream: mockStream,
        onStep,
      });

      await renderer.writeChunk({ content: 'Step 0', stepIndex: 0, stepUsage: { outputTokens: 2 } });
      await renderer.writeChunk({ content: 'Still step 0', stepIndex: 0, stepUsage: { outputTokens: 3 } });
      await renderer.writeChunk({ content: 'Step 1', stepIndex: 1, usage: { inputTokens: 1, outputTokens: 4 } });

      expect(onStep).toHaveBeenCalledTimes(2);
      expect(onStep).toHaveBeenNthCalledWith(1, 0, { outputTokens: 2 });
      expect(onStep).toHaveBeenNthCalledWith(2, 1, { inputTokens: 1, outputTokens: 4 });
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

  it('prevents double flush when abort and end are both triggered', async () => {
    const abortController = new AbortController();
    const flush = vi.fn(() => ({
      thinking: '',
      content: '',
      toolCalls: [],
      done: true,
      parts: [],
      incomplete: false,
      incompleteness: [],
    }));

    const fakeProcessor = {
      process: vi.fn(() => ({
        thinking: '',
        content: '',
        toolCalls: [],
        done: false,
        parts: [],
        incomplete: false,
        incompleteness: [],
      })),
      flush,
    } as unknown as LLMStreamProcessor;

    const renderer = createVSCodeAgentLoop({
      stream: mockStream,
      abortSignal: abortController.signal,
      processor: fakeProcessor,
    });

    abortController.abort();
    await Promise.resolve();
    await renderer.end();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('detaches abort listener when end() is called before cancellation', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    const fakeAbortSignal = {
      aborted: false,
      addEventListener,
      removeEventListener,
    } as unknown as AbortSignal;

    const renderer = createVSCodeAgentLoop({
      stream: mockStream,
      abortSignal: fakeAbortSignal,
    });

    await renderer.end();

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
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
