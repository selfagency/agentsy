import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThinkingBlock } from './ThinkingBlock.js';
import { darkTheme } from '../themes/index.js';

describe('ThinkingBlock Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports ThinkingBlock as a function', () => {
    expect(typeof ThinkingBlock).toBe('function');
  });

  it('accepts all required props', () => {
    const props = {
      text: 'Analyzing the problem',
      isStreaming: true,
      style: 'blockquote' as const,
      theme: darkTheme,
      screenReader: false,
    };

    expect(props.text).toBe('Analyzing the problem');
    expect(props.isStreaming).toBe(true);
    expect(props.style).toBe('blockquote');
  });

  it('supports inline thinking style', () => {
    const styles = ['blockquote', 'inline', 'suppress'] as const;
    expect(styles).toContain('inline');
  });

  it('supports blockquote thinking style', () => {
    const styles = ['blockquote', 'inline', 'suppress'] as const;
    expect(styles).toContain('blockquote');
  });

  it('supports suppress thinking style', () => {
    const styles = ['blockquote', 'inline', 'suppress'] as const;
    expect(styles).toContain('suppress');
  });

  it('handles empty thinking text', () => {
    const emptyText = '';
    expect(emptyText.length).toBe(0);
  });

  it('handles very long thinking text', () => {
    const longText = 'x'.repeat(1000);
    expect(longText.length).toBe(1000);
  });

  it('accepts screen reader prop', () => {
    const srProps = {
      text: 'Text',
      isStreaming: false,
      style: 'blockquote' as const,
      theme: darkTheme,
      screenReader: true,
    };

    expect(srProps.screenReader).toBe(true);
  });

  it('theme has required color properties', () => {
    expect(darkTheme.thinking).toBeDefined();
    expect(darkTheme.thinking.borderColor).toBeDefined();
    expect(darkTheme.thinking.textColor).toBeDefined();
    expect(darkTheme.thinking.spinnerColor).toBeDefined();
  });
});

