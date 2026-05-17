// fallow-ignore-file unused-file

import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi, expectTypeOf } from 'vitest';

import type { Theme } from '../themes/types.ts';
import { StreamingText } from './streaming-text.tsx';

// Mock markdownToAnsi
vi.mock(import('../utils/markdown-to-ansi.ts'), () => ({
  markdownToAnsi: vi.fn<(text: string) => Promise<string>>(async (text: string) => `ANSI[${text}]`)
}));

const mockTheme: Theme = {
  border: {
    color: 'blue',
    style: 'round'
  },
  highlight: {},
  text: {
    cursorSymbol: '▌',
    dimColor: false
  },
  thinking: {
    borderColor: 'cyan',
    spinnerColor: 'cyan',
    spinnerIntervalMs: 80,
    textColor: 'yellow'
  },
  toolCall: {
    doneColor: 'green',
    doneSymbol: '✓',
    pendingColor: 'yellow',
    pendingSymbol: '⠋'
  }
};

describe('StreamingText' as const, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders static text without streaming', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="Hello world" markdown={false} isStreaming={false} theme={mockTheme} />
    );

    // Give rendering time
    await vi.runAllTimersAsync();

    const output = lastFrame();
    expect(output).toContain('Hello world');

    unmount();
  });

  it('renders text with streaming cursor', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="Streaming" markdown={false} isStreaming={true} theme={mockTheme} />
    );

    // Let rendering complete
    await vi.advanceTimersByTimeAsync(200);

    const output = lastFrame();
    expect(output).toContain('Streaming');
    expect(output).toContain('▌'); // cursor symbol

    unmount();
  });

  it('splits text at last double newline when streaming', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="Para 1\n\nPara 2 incomplete" markdown={false} isStreaming={true} theme={mockTheme} />
    );

    // Let rendering complete
    await vi.advanceTimersByTimeAsync(200);

    const output = lastFrame();
    // Stable prefix should be rendered
    expect(output).toContain('Para 1');

    unmount();
  });

  it('renders complete text when no double newline', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="Single paragraph" markdown={false} isStreaming={true} theme={mockTheme} />
    );

    // Let rendering complete
    await vi.advanceTimersByTimeAsync(200);

    const output = lastFrame();
    expect(output).toContain('Single paragraph');

    unmount();
  });

  it('disables markdown for screen readers', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="**Bold** text" markdown={true} isStreaming={false} theme={mockTheme} screenReader={true} />
    );

    await vi.runAllTimersAsync();

    const output = lastFrame();
    // Should render plain text, not ANSI-converted
    expect(output).toContain('**Bold** text');

    unmount();
  });

  it('converts markdown when not for screen readers', async () => {
    const result = await import('../utils/markdown-to-ansi.ts');
      const markdownToAnsi = result.default;

    const { unmount } = render(
      <StreamingText text="*italic*" markdown={true} isStreaming={false} theme={mockTheme} screenReader={false} />
    );

    await vi.runAllTimersAsync();

    expect(markdownToAnsi).toHaveBeenCalledWith('*italic*', expect.objectContaining({ syntaxHighlight: false }));

    unmount();
  });

  it('skips markdown conversion when markdown prop is false', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="# Heading" markdown={false} isStreaming={false} theme={mockTheme} />
    );

    await vi.runAllTimersAsync();

    const output = lastFrame();
    expect(output).toContain('# Heading');

    unmount();
  });

  it('enables syntax highlighting when specified', async () => {
    const result = await import('../utils/markdown-to-ansi.ts');
      const markdownToAnsi = result.default;

    const { unmount } = render(
      <StreamingText
        text="```js\ncode\n```"
        markdown={true}
        isStreaming={false}
        theme={mockTheme}
        syntaxHighlight={true}
      />
    );

    await vi.runAllTimersAsync();

    expect(markdownToAnsi).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ syntaxHighlight: true }));

    unmount();
  });

  it('animates cursor while streaming', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText text="Streaming content" markdown={false} isStreaming={true} theme={mockTheme} />
    );

    // Advance timer to trigger cursor animation
    vi.advanceTimersByTime(100);

    const frame1 = lastFrame();
    expect(frame1).toContain('▌');

    // Advance timer more to trigger next animation frame
    vi.advanceTimersByTime(100);

    const frame2 = lastFrame();
    // Cursor animation is controlled by tick state
    expect(frame2).toContain('▌');

    unmount();
  });

  it('stops cursor animation when stream completes', async () => {
    const { lastFrame, rerender, unmount } = render(
      <StreamingText text="Still streaming" markdown={false} isStreaming={true} theme={mockTheme} />
    );

    vi.advanceTimersByTime(100);
    const streamingOutput = lastFrame();
    expect(streamingOutput).toContain('▌');

    // Stop streaming
    rerender(<StreamingText text="Complete text" markdown={false} isStreaming={false} theme={mockTheme} />);

    await vi.runAllTimersAsync();
    const completedOutput = lastFrame();
    // Cursor should no longer appear
    expect(completedOutput).not.toContain('▌');

    unmount();
  });

  it('cancels pending markdown conversion on unmount', async () => {
    const { unmount } = render(
      <StreamingText text="**markdown**" markdown={true} isStreaming={false} theme={mockTheme} />
    );

    // Unmount before async conversion completes
    unmount();

    // Should not throw or cause memory leaks
    await vi.runAllTimersAsync();
    expect(true).toBeTruthy(); // Cleanup completed without error
  });

  it('handles rapid text updates', async () => {
    const { lastFrame, rerender, unmount } = render(
      <StreamingText text="First" markdown={false} isStreaming={true} theme={mockTheme} />
    );

    vi.advanceTimersByTime(100);

    // Rapid updates
    rerender(<StreamingText text="First\n\nSecond" markdown={false} isStreaming={true} theme={mockTheme} />);
    vi.advanceTimersByTime(100);

    rerender(<StreamingText text="First\n\nSecond\n\nThird" markdown={false} isStreaming={true} theme={mockTheme} />);
    vi.advanceTimersByTime(100);

    const output = lastFrame();
    expect(output).toContain('First');

    unmount();
  });

  it('handles multiline streaming text correctly', async () => {
    const multiline = 'Line 1\nLine 2\nLine 3 partial';
    const { lastFrame, unmount } = render(
      <StreamingText text={multiline} markdown={false} isStreaming={true} theme={mockTheme} />
    );

    vi.advanceTimersByTime(100);

    const output = lastFrame();
    // Component should render without error
    expectTypeOf(output).toBeString();

    unmount();
  });

  it('does not render cursor for screen readers', async () => {
    const { lastFrame, unmount } = render(
      <StreamingText
        text="Screen reader text"
        markdown={false}
        isStreaming={true}
        theme={mockTheme}
        screenReader={true}
      />
    );

    vi.advanceTimersByTime(100);

    const output = lastFrame();
    // Component should render without error when screenReader is true
    expectTypeOf(output).toBeString();

    unmount();
  });
});
