import { describe, expect, it } from 'vitest';
import { hasMarkdownSyntax } from './markdownToAnsi.js';

describe('Markdown Detection with Tightened Regex', () => {
  describe('Detects valid markdown patterns', () => {
    it('detects headings', () => {
      expect(hasMarkdownSyntax('# Heading')).toBe(true);
      expect(hasMarkdownSyntax('## Subheading')).toBe(true);
      expect(hasMarkdownSyntax('### Level 3')).toBe(true);
    });

    it('detects code fences', () => {
      expect(hasMarkdownSyntax('```typescript\ncode\n```')).toBe(true);
      expect(hasMarkdownSyntax('```\ncode\n```')).toBe(true);
    });

    it('detects inline code', () => {
      expect(hasMarkdownSyntax('Use `variable` in code')).toBe(true);
    });

    it('detects bold text', () => {
      expect(hasMarkdownSyntax('This is **bold text**')).toBe(true);
      expect(hasMarkdownSyntax('This is __bold text__')).toBe(true);
    });

    it('detects unordered lists', () => {
      expect(hasMarkdownSyntax('- Item 1\n- Item 2')).toBe(true);
      expect(hasMarkdownSyntax('* Item 1\n* Item 2')).toBe(true);
    });

    it('detects ordered lists', () => {
      expect(hasMarkdownSyntax('1. First\n2. Second')).toBe(true);
    });

    it('detects links', () => {
      expect(hasMarkdownSyntax('[Link text](https://example.com)')).toBe(true);
      expect(hasMarkdownSyntax('[example](path/to/file)')).toBe(true);
    });
  });

  describe('Avoids false positives', () => {
    it('does not detect single * or _ in mathematical expressions', () => {
      expect(hasMarkdownSyntax('number is 5*3')).toBe(false);
      expect(hasMarkdownSyntax('math: 10/5*2')).toBe(false);
      expect(hasMarkdownSyntax('constant_value')).toBe(false);
    });

    it('does not detect incomplete patterns', () => {
      expect(hasMarkdownSyntax('This is just text')).toBe(false);
      expect(hasMarkdownSyntax('Some regular content here')).toBe(false);
    });

    it('does not detect incomplete code fences', () => {
      expect(hasMarkdownSyntax('some regular text')).toBe(false);
    });

    it('does not detect unmatched link brackets', () => {
      expect(hasMarkdownSyntax('This (text) has parens')).toBe(false);
      expect(hasMarkdownSyntax('array[index] access')).toBe(false);
    });
  });

  describe('Handles edge cases', () => {
    it('works with empty string', () => {
      expect(hasMarkdownSyntax('')).toBe(false);
    });

    it('works with very long strings (only samples first 500 chars)', () => {
      const longText = `${'a'.repeat(600)}\n# Heading`;
      // Should not detect heading since it's beyond 500 char sample
      expect(hasMarkdownSyntax(longText)).toBe(false);
    });

    it('detects markdown within first 500 chars', () => {
      const textWithHeading = `# Heading\n${'a'.repeat(600)}`;
      expect(hasMarkdownSyntax(textWithHeading)).toBe(true);
    });

    it('detects multiple patterns', () => {
      expect(hasMarkdownSyntax('# Title\n\n**Bold** and *italic*')).toBe(true);
      expect(hasMarkdownSyntax('- List item\n```code```')).toBe(true);
    });
  });
});
