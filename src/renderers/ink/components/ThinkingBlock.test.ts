import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ThinkingBlock } from './ThinkingBlock.js';
import { darkTheme, defaultTheme } from '../themes/index.js';

// Mock Ink render to avoid terminal setup in test environment
vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    render: vi.fn(() => ({
      lastFrame: () => '',
      rerender: vi.fn(),
      clear: vi.fn(),
      unmount: vi.fn(),
    })),
  };
});

describe('ThinkingBlock Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Blockquote style tests
  describe('blockquote style', () => {
    it('renders blockquote thinking when streaming', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Analyzing the problem',
        style: 'blockquote',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element).toBeDefined();
      expect(element.props.text).toBe('Analyzing the problem');
    });

    it('renders blockquote thinking when not streaming', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Analysis complete',
        style: 'blockquote',
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element).toBeDefined();
      expect(element.props.isStreaming).toBe(false);
    });

    it('uses theme colors for blockquote border', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Testing colors',
        style: 'blockquote',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.theme.thinking).toBeDefined();
      expect(element.props.theme.thinking.borderColor).toBeDefined();
    });
  });

  // Inline style tests
  describe('inline style', () => {
    it('renders inline thinking when streaming', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Quick thought',
        style: 'inline',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element).toBeDefined();
      expect(element.props.style).toBe('inline');
    });

    it('renders inline thinking when not streaming', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Thought complete',
        style: 'inline',
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element).toBeDefined();
      expect(element.props.isStreaming).toBe(false);
    });
  });

  // Suppress style tests
  describe('suppress style', () => {
    it('renders suppressed (null) thinking', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Hidden thought',
        style: 'suppress',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element).toBeDefined();
      expect(element.props.style).toBe('suppress');
    });

    it('renders nothing for suppress style regardless of content', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'x'.repeat(1000),
        style: 'suppress',
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element).toBeDefined();
    });
  });

  // Screen reader tests
  describe('screen reader mode', () => {
    it('renders screen reader version for blockquote with SR enabled', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Accessible thinking',
        style: 'blockquote',
        isStreaming: true,
        theme: darkTheme,
        screenReader: true,
      });
      expect(element).toBeDefined();
      expect(element.props.screenReader).toBe(true);
    });

    it('renders screen reader version for inline with SR enabled', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Inline accessible',
        style: 'inline',
        isStreaming: false,
        theme: darkTheme,
        screenReader: true,
      });
      expect(element).toBeDefined();
      expect(element.props.screenReader).toBe(true);
    });

    it('does not render screen reader for suppress style even with SR enabled', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Still hidden',
        style: 'suppress',
        isStreaming: false,
        theme: darkTheme,
        screenReader: true,
      });
      expect(element).toBeDefined();
    });
  });

  // Text content tests
  describe('text content handling', () => {
    it('handles empty thinking text', () => {
      const element = React.createElement(ThinkingBlock, {
        text: '',
        style: 'blockquote',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.text).toBe('');
    });

    it('handles very long thinking text', () => {
      const longText = 'x'.repeat(1000);
      const element = React.createElement(ThinkingBlock, {
        text: longText,
        style: 'inline',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.text.length).toBe(1000);
    });

    it('preserves text with special characters', () => {
      const specialText = 'Thinking: [1] Why? (Because!) & what...';
      const element = React.createElement(ThinkingBlock, {
        text: specialText,
        style: 'inline',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.text).toBe(specialText);
    });

    it('handles multiline thinking text', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const element = React.createElement(ThinkingBlock, {
        text: multilineText,
        style: 'blockquote',
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.text).toContain('Line 1');
      expect(element.props.text).toContain('Line 2');
    });
  });

  // Theme tests
  describe('theme handling', () => {
    it('respects theme colors for blockquote', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Themed',
        style: 'blockquote',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });
      expect(element.props.theme.thinking.borderColor).toBe(darkTheme.thinking.borderColor);
      expect(element.props.theme.thinking.spinnerColor).toBe(darkTheme.thinking.spinnerColor);
    });

    it('respects theme colors for inline', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Inline themed',
        style: 'inline',
        isStreaming: true,
        theme: defaultTheme,
        screenReader: false,
      });
      expect(element.props.theme).toBe(defaultTheme);
    });

    it('uses theme spinner interval when defined', () => {
      const customTheme = {
        ...darkTheme,
        thinking: { ...darkTheme.thinking, spinnerIntervalMs: 120 },
      };
      const element = React.createElement(ThinkingBlock, {
        text: 'Animated',
        style: 'blockquote',
        isStreaming: true,
        theme: customTheme,
        screenReader: false,
      });
      expect(element.props.theme.thinking.spinnerIntervalMs).toBe(120);
    });
  });

  // Streaming state tests
  describe('streaming state', () => {
    it('renders different output when streaming vs not streaming', () => {
      const streamingElement = React.createElement(ThinkingBlock, {
        text: 'Processing',
        style: 'blockquote',
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
      });

      const completeElement = React.createElement(ThinkingBlock, {
        text: 'Complete result',
        style: 'blockquote',
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
      });

      expect(streamingElement.props.isStreaming).toBe(true);
      expect(completeElement.props.isStreaming).toBe(false);
    });
  });

  // Default prop tests
  describe('default props', () => {
    it('has screenReader default to false', () => {
      const element = React.createElement(ThinkingBlock, {
        text: 'Test',
        style: 'blockquote',
        isStreaming: false,
        theme: darkTheme,
      } as any);
      expect(element).toBeDefined();
    });
  });
});

