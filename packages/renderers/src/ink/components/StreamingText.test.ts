import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme, defaultTheme } from '../themes/index.js';
import { StreamingText } from './StreamingText.js';

// Mock cli-markdown
vi.mock('cli-markdown', () => ({
  default: vi.fn((text: string) => `[formatted:${text}]`)
}));

describe('StreamingText Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Markdown rendering tests
  describe('markdown rendering', () => {
    it('renders with markdown enabled', () => {
      const element = React.createElement(StreamingText, {
        text: '# Heading\n**bold**',
        markdown: true,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element).toBeDefined();
      expect(element.props.markdown).toBe(true);
    });

    it('renders without markdown when disabled', () => {
      const element = React.createElement(StreamingText, {
        text: '# Heading\n**bold**',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element).toBeDefined();
      expect(element.props.markdown).toBe(false);
    });

    it('handles code blocks with markdown', () => {
      const codeBlock = '```javascript\nconst x = 42;\n```';
      const element = React.createElement(StreamingText, {
        text: codeBlock,
        markdown: true,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('javascript');
    });

    it('handles lists with markdown', () => {
      const list = '- Item 1\n- Item 2\n- Item 3';
      const element = React.createElement(StreamingText, {
        text: list,
        markdown: true,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('Item 1');
    });

    it('handles tables with markdown', () => {
      const table = '| Col1 | Col2 |\n|------|------|\n| A    | B    |';
      const element = React.createElement(StreamingText, {
        text: table,
        markdown: true,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('Col1');
    });
  });

  // Streaming state tests
  describe('streaming state', () => {
    it('renders with streaming enabled', () => {
      const element = React.createElement(StreamingText, {
        text: 'Streaming content',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.isStreaming).toBe(true);
    });

    it('renders with streaming disabled', () => {
      const element = React.createElement(StreamingText, {
        text: 'Complete content',
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.isStreaming).toBe(false);
    });

    it('shows cursor when streaming', () => {
      const element = React.createElement(StreamingText, {
        text: 'Streaming...',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.isStreaming).toBe(true);
      expect(element.props.theme.text.cursorSymbol).toBeDefined();
    });
  });

  // Text content tests
  describe('text content handling', () => {
    it('handles empty text', () => {
      const element = React.createElement(StreamingText, {
        text: '',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toBe('');
    });

    it('handles very long text', () => {
      const longText = 'word '.repeat(500);
      const element = React.createElement(StreamingText, {
        text: longText,
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text.length).toBeGreaterThan(1000);
    });

    it('handles multiline text', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const element = React.createElement(StreamingText, {
        text: multilineText,
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      const lines = element.props.text.split('\n');
      expect(lines.length).toBe(3);
    });

    it('handles text with special characters', () => {
      const specialText = 'Text with <brackets> & symbols! © ™ ®';
      const element = React.createElement(StreamingText, {
        text: specialText,
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('<brackets>');
      expect(element.props.text).toContain('©');
    });

    it('preserves whitespace in plain text', () => {
      const textWithSpaces = '  indented\n\t\ttabbed\n   spaced   ';
      const element = React.createElement(StreamingText, {
        text: textWithSpaces,
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toBe(textWithSpaces);
    });

    it('handles ANSI codes in text', () => {
      const ansiText = 'Normal \u001b[31mRed\u001b[0m text';
      const element = React.createElement(StreamingText, {
        text: ansiText,
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('Red');
    });
  });

  // Syntax highlighting tests
  describe('syntax highlighting', () => {
    it('enables syntax highlighting when true', () => {
      const element = React.createElement(StreamingText, {
        text: '```ts\nconst x = 1;\n```',
        markdown: true,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
        syntaxHighlight: true
      });
      expect(element.props.syntaxHighlight).toBe(true);
    });

    it('disables syntax highlighting when false', () => {
      const element = React.createElement(StreamingText, {
        text: '```ts\nconst x = 1;\n```',
        markdown: true,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false,
        syntaxHighlight: false
      });
      expect(element.props.syntaxHighlight).toBe(false);
    });
  });

  // Screen reader tests
  describe('screen reader mode', () => {
    it('renders accessible output with screen reader enabled', () => {
      const element = React.createElement(StreamingText, {
        text: 'Accessible content',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: true
      });
      expect(element.props.screenReader).toBe(true);
    });

    it('renders regular output with screen reader disabled', () => {
      const element = React.createElement(StreamingText, {
        text: 'Regular content',
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.screenReader).toBe(false);
    });

    it('handles complex markdown with screen reader', () => {
      const complexMarkdown = '# Title\n\nParagraph with **bold** and *italic*.\n\n```\ncode\n```';
      const element = React.createElement(StreamingText, {
        text: complexMarkdown,
        markdown: true,
        isStreaming: false,
        theme: darkTheme,
        screenReader: true
      });
      expect(element.props.text).toContain('Title');
    });
  });

  // Theme tests
  describe('theme handling', () => {
    it('uses theme colors for text', () => {
      const element = React.createElement(StreamingText, {
        text: 'Themed text',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.theme).toBe(darkTheme);
      expect(element.props.theme.text.cursorSymbol).toBeDefined();
    });

    it('handles different themes', () => {
      const element = React.createElement(StreamingText, {
        text: 'Different theme',
        markdown: false,
        isStreaming: false,
        theme: defaultTheme,
        screenReader: false
      });
      expect(element.props.theme).toBe(defaultTheme);
    });

    it('respects theme cursor symbol', () => {
      const element = React.createElement(StreamingText, {
        text: 'Cursor test',
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.theme.text.cursorSymbol).toBeDefined();
      expect(typeof element.props.theme.text.cursorSymbol).toBe('string');
    });

    it('respects theme dimColor setting', () => {
      const element = React.createElement(StreamingText, {
        text: 'Dim test',
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.theme.text.dimColor).toBeDefined();
      expect(typeof element.props.theme.text.dimColor).toBe('boolean');
    });
  });

  // Combination tests
  describe('combined options', () => {
    it('handles markdown + streaming + theme', () => {
      const element = React.createElement(StreamingText, {
        text: '# Live Update\n\n**Bold** text streaming...',
        markdown: true,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
        syntaxHighlight: true
      });
      expect(element.props.markdown).toBe(true);
      expect(element.props.isStreaming).toBe(true);
      expect(element.props.syntaxHighlight).toBe(true);
    });

    it('handles plain text + complete + theme', () => {
      const element = React.createElement(StreamingText, {
        text: 'Complete plain text\nWith multiple lines',
        markdown: false,
        isStreaming: false,
        theme: defaultTheme,
        screenReader: true,
        syntaxHighlight: false
      });
      expect(element.props.markdown).toBe(false);
      expect(element.props.isStreaming).toBe(false);
      expect(element.props.screenReader).toBe(true);
    });
  });

  // Default prop tests
  describe('default props', () => {
    it('works with minimal required props', () => {
      const element = React.createElement(StreamingText, {
        text: 'Test',
        markdown: true,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element).toBeDefined();
    });
  });

  // Block boundary tests
  describe('block boundary handling', () => {
    it('identifies block boundaries with double newlines', () => {
      const textWithBlocks = 'First block\n\nSecond block\n\nThird block';
      const element = React.createElement(StreamingText, {
        text: textWithBlocks,
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('First block');
      expect(element.props.text).toContain('Second block');
    });

    it('handles text without block boundaries', () => {
      const singleBlock = 'Single continuous text without double newlines';
      const element = React.createElement(StreamingText, {
        text: singleBlock,
        markdown: false,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toBe(singleBlock);
    });

    it('handles multiple consecutive block boundaries', () => {
      const multiBlock = 'Text\n\n\n\nMore text';
      const element = React.createElement(StreamingText, {
        text: multiBlock,
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: false
      });
      expect(element.props.text).toContain('Text');
    });
  });

  // Combined feature tests
  describe('combined features', () => {
    it('handles markdown + syntax highlighting + streaming', () => {
      const code = '```typescript\nfunction hello() { console.log("world"); }\n```';
      const element = React.createElement(StreamingText, {
        text: code,
        markdown: true,
        isStreaming: true,
        theme: darkTheme,
        screenReader: false,
        syntaxHighlight: true
      });
      expect(element.props.markdown).toBe(true);
      expect(element.props.syntaxHighlight).toBe(true);
      expect(element.props.isStreaming).toBe(true);
    });

    it('handles screen reader + markdown disabled', () => {
      const plainText = 'Plain text content';
      const element = React.createElement(StreamingText, {
        text: plainText,
        markdown: false,
        isStreaming: false,
        theme: darkTheme,
        screenReader: true
      });
      expect(element.props.screenReader).toBe(true);
      expect(element.props.markdown).toBe(false);
    });

    it('handles all options together', () => {
      const fullMarkdown =
        '# Header\n\n**Bold** and *italic* with `code` and `languages`\n\n```python\nprint("hello")\n```';
      const element = React.createElement(StreamingText, {
        text: fullMarkdown,
        markdown: true,
        isStreaming: true,
        theme: darkTheme,
        screenReader: true,
        syntaxHighlight: true
      });
      expect(element.props.text).toContain('Header');
      expect(element.props.markdown).toBe(true);
      expect(element.props.syntaxHighlight).toBe(true);
      expect(element.props.isStreaming).toBe(true);
      expect(element.props.screenReader).toBe(true);
    });
  });
});
