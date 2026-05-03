import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '../themes/types.js';
import { ThinkingBlock } from './ThinkingBlock.js';

// Mock default theme
const mockTheme: Theme = {
  text: {
    dimColor: false,
    cursorSymbol: '▌',
  },
  border: {
    style: 'round',
    color: 'blue',
  },
  thinking: {
    spinnerColor: 'cyan',
    textColor: 'yellow',
    spinnerIntervalMs: 80,
  },
};

describe('ThinkingBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing for suppress style', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="thinking..." style="suppress" isStreaming={true} theme={mockTheme} />,
    );

    const output = lastFrame();
    expect(output).toBe('');
  });

  it('renders inline thinking text', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="reasoning process" style="inline" isStreaming={false} theme={mockTheme} />,
    );

    const output = lastFrame();
    expect(output).toContain('[Thinking] reasoning process');
  });

  it('renders inline thinking with streaming indicator', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="reasoning" style="inline" isStreaming={true} theme={mockTheme} />,
    );

    const output = lastFrame();
    expect(output).toContain('[Thinking] reasoning…');
  });

  it('renders blockquote thinking with spinner', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="thinking..." style="blockquote" isStreaming={true} theme={mockTheme} />,
    );

    const output = lastFrame();
    expect(output).toContain('thinking…');
  });

  it('renders blockquote thinking without text when streaming', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="partial thought" style="blockquote" isStreaming={true} theme={mockTheme} />,
    );

    const output = lastFrame();
    // Should show spinner animation, not full text
    expect(output).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it('renders full blockquote thinking text when not streaming', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="complete thought" style="blockquote" isStreaming={false} theme={mockTheme} />,
    );

    const output = lastFrame();
    expect(output).toContain('complete thought');
  });

  it('animates spinner during streaming blockquote', async () => {
    const { lastFrame, unmount } = render(
      <ThinkingBlock text="thinking" style="blockquote" isStreaming={true} theme={mockTheme} />,
    );

    const frame1 = lastFrame();
    expect(frame1).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);

    // Advance time to trigger next frame
    vi.advanceTimersByTime(80);

    const frame2 = lastFrame();
    // Spinner should have changed
    expect(frame2).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);

    unmount();
  });

  it('renders screen reader friendly inline thinking', () => {
    const { lastFrame } = render(
      <ThinkingBlock
        text="SR reasoning"
        style="inline"
        isStreaming={false}
        theme={mockTheme}
        screenReader={true}
      />,
    );

    const output = lastFrame();
    expect(output).toContain('Thinking:');
    expect(output).toContain('SR reasoning');
  });

  it('renders screen reader friendly blockquote thinking', () => {
    const { lastFrame } = render(
      <ThinkingBlock
        text="SR thought"
        style="blockquote"
        isStreaming={false}
        theme={mockTheme}
        screenReader={true}
      />,
    );

    const output = lastFrame();
    expect(output).toContain('Thinking:');
    expect(output).toContain('SR thought');
  });

  it('uses custom theme colors for inline thinking', () => {
    const customTheme: Theme = {
      ...mockTheme,
      thinking: {
        ...mockTheme.thinking,
        textColor: 'red',
      },
    };

    const { lastFrame } = render(
      <ThinkingBlock text="colored thought" style="inline" isStreaming={false} theme={customTheme} />,
    );

    const output = lastFrame();
    expect(output).toContain('colored thought');
  });

  it('handles empty thinking text', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="" style="inline" isStreaming={true} theme={mockTheme} />,
    );

    const output = lastFrame();
    expect(output).toContain('[Thinking]');
  });

  it('stops spinner animation when not streaming', () => {
    const { lastFrame, unmount } = render(
      <ThinkingBlock text="thought" style="blockquote" isStreaming={true} theme={mockTheme} />,
    );

    vi.advanceTimersByTime(160); // Advance past animation
    const _streamingFrame = lastFrame();

    // Re-render without streaming
    unmount();
    const { lastFrame: finalFrame } = render(
      <ThinkingBlock text="thought" style="blockquote" isStreaming={false} theme={mockTheme} />,
    );

    const nonStreamingFrame = finalFrame();
    expect(nonStreamingFrame).toContain('thought');
  });
});
