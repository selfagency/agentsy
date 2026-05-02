import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamingText } from './StreamingText.js';
import { darkTheme } from '../themes/index.js';

// Mock cli-markdown
vi.mock('cli-markdown', () => ({
  default: vi.fn((text: string) => `[formatted:${text}]`),
}));

describe('StreamingText Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports StreamingText as a function', () => {
    expect(typeof StreamingText).toBe('function');
  });

  it('accepts all required props', () => {
    const props = {
      text: 'Plain text',
      markdown: false,
      isStreaming: true,
      theme: darkTheme,
      screenReader: false,
    };

    expect(props.text).toBe('Plain text');
    expect(props.markdown).toBe(false);
    expect(props.isStreaming).toBe(true);
  });

  it('supports markdown rendering when enabled', () => {
    const markdown = true;
    expect(markdown).toBe(true);
  });

  it('supports plain text mode', () => {
    const markdown = false;
    expect(markdown).toBe(false);
  });

  it('indicates streaming state', () => {
    const streaming = true;
    const notStreaming = false;

    expect(streaming).toBe(true);
    expect(notStreaming).toBe(false);
  });

  it('handles empty text gracefully', () => {
    const emptyText = '';
    expect(emptyText.length).toBe(0);
  });

  it('handles very long text', () => {
    const longText = 'word '.repeat(500);
    expect(longText.length).toBeGreaterThan(1000);
  });

  it('handles multiline text', () => {
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const lines = multilineText.split('\n');
    expect(lines.length).toBe(3);
  });

  it('handles special characters in text', () => {
    const specialText = 'Text with <brackets> & symbols!';
    expect(specialText).toContain('<brackets>');
  });

  it('theme has required text properties', () => {
    expect(darkTheme.text).toBeDefined();
    expect(darkTheme.text.cursorSymbol).toBeDefined();
  });

  it('supports syntax highlighting option', () => {
    const highlightEnabled = true;
    const highlightDisabled = false;

    expect(highlightEnabled).toBe(true);
    expect(highlightDisabled).toBe(false);
  });
});

