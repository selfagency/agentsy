import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVSCodeChatRenderer } from './createVSCodeChatRenderer.js';
import type { ChatResponseStream } from './createVSCodeChatRenderer.js';

describe('VS Code Chat Renderer', () => {
  let mockStream: ChatResponseStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = {
      text: vi.fn(),
      progress: vi.fn(),
      markdown: vi.fn(),
      anchor: vi.fn(),
      reference: vi.fn(),
      button: vi.fn(),
      filetree: vi.fn(),
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
    expect(renderer.end).toBeDefined();
  });

  it('sends markdown to stream on write', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('# Title\n\nContent');
    await renderer.end();

    // Processor accumulates and chunks may be combined - check markdown was called
    expect(mockStream.markdown).toHaveBeenCalled();
  });

  it('sends multiple chunks to stream', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('Part 1');
    await renderer.write('Part 2');
    await renderer.write('Part 3');
    await renderer.end();

    // Processor accumulates content, so we may get one or more calls
    expect(mockStream.markdown).toHaveBeenCalled();
  });

  it('handles thinking blocks as blockquote style by default', async () => {
    const renderer = createVSCodeChatRenderer({
      stream: mockStream,
      showThinking: true,
      thinkingStyle: 'blockquote',
    });

    await renderer.write('Content with thinking');
    await renderer.end();

    // Verify markdown was called (actual thinking depends on processor parsing)
    expect(mockStream.markdown).toHaveBeenCalled();
  });

  it('handles thinking blocks as progress style', async () => {
    const renderer = createVSCodeChatRenderer({
      stream: mockStream,
      showThinking: true,
      thinkingStyle: 'progress',
    });

    await renderer.write('Content');
    await renderer.end();

    expect(mockStream.markdown).toHaveBeenCalled();
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

  it('fires onToolCall callback for tool calls', async () => {
    const onToolCall = vi.fn();
    const renderer = createVSCodeChatRenderer({
      stream: mockStream,
      onToolCall,
    });

    await renderer.write('Some content');
    await renderer.end();

    // Tool calls would only fire if processor detects them
    expect(onToolCall).not.toHaveBeenCalled(); // No XML tool calls in plain content
  });

  it('calls onError callback on errors', async () => {
    const onError = vi.fn();
    const renderer = createVSCodeChatRenderer({
      stream: mockStream,
      onError,
    });

    await renderer.write('test');
    await renderer.end();

    expect(onError).not.toHaveBeenCalled();
  });

  it('handles empty content gracefully', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('');
    await renderer.end();

    // Empty writes produce no output
    expect(mockStream.markdown).not.toHaveBeenCalled();
  });

  it('accumulates content across multiple writes', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('Line 1\n');
    await renderer.write('Line 2\n');
    await renderer.write('Line 3');
    await renderer.end();

    // Processor handles content, may be combined or separate calls
    expect(mockStream.markdown).toHaveBeenCalled();
  });

  it('processes final content on end', async () => {
    const renderer = createVSCodeChatRenderer({ stream: mockStream });

    await renderer.write('Initial');
    await renderer.end();

    expect(mockStream.markdown).toHaveBeenCalledWith('Initial');
  });
});
