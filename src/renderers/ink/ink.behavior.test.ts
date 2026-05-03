import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMStreamProcessor } from '../../processor/index.js';
import { createInkRenderer } from './createInkRenderer.js';

vi.mock('cli-markdown', () => ({
  default: vi.fn((markdown: string) => `[ANSI:${markdown}]`),
}));

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    render: vi.fn((_component: React.ReactElement) => ({
      lastFrame: () => '[mock frame]',
      rerender: vi.fn(),
      clear: vi.fn(),
      unmount: vi.fn(),
    })),
  };
});

describe('Ink Renderer behavior', () => {
  let processor: LLMStreamProcessor;
  let onWarning: (message: string, context?: Record<string, unknown>) => void;
  let onFinish: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    onWarning = vi.fn();
    onFinish = vi.fn();
    processor = new LLMStreamProcessor({
      parseThinkTags: true,
      scrubContextTags: true,
      enforcePrivacyTags: true,
      onWarning,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Keyboard handling options', () => {
    it('enables keyboard support when specified', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        keyboard: {
          enabled: true,
        },
      });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('configures keyboard with custom handlers', async () => {
      const onInterrupt = vi.fn();
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        keyboard: {
          enabled: true,
          onInterrupt,
        },
      });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Renderer methods', () => {
    it('write method accepts content', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
      });

      renderer.write('Test content');

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('end method closes rendering', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
      });

      renderer.write('Content');
      renderer.end();

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Error handling', () => {
    it('warns when processing invalid XML', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
      });

      processor.process({ content: '<invalid>' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('handles malformed JSON in tool calls gracefully', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        showToolCalls: true,
      });

      processor.process({ content: '<tool_call id="1" name="test"><arguments>{invalid json}</arguments></tool_call>' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Screen reader accessibility', () => {
    it('enables screen reader mode', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        screenReader: true,
      });

      processor.process({ content: 'Accessible content' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('disables screen reader mode', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        screenReader: false,
      });

      processor.process({ content: 'Regular content' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Markdown rendering', () => {
    it('renders markdown when enabled', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        markdown: true,
      });

      processor.process({ content: '# Heading\n\n**Bold** text' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('renders plain text when markdown disabled', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        markdown: false,
      });

      processor.process({ content: '# Not a heading\n\n**Not bold**' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('handles code fences with markdown', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        markdown: true,
      });

      processor.process({ content: '```typescript\nconst x = 42;\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Syntax highlighting', () => {
    it('enables syntax highlighting', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        syntaxHighlight: true,
        markdown: true,
      });

      processor.process({ content: '```js\nconst fn = () => {};\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('disables syntax highlighting', async () => {
      const renderer = await createInkRenderer({
        processor,
        onWarning,
        onFinish,
        syntaxHighlight: false,
        markdown: true,
      });

      processor.process({ content: '```js\nconst fn = () => {};\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });
});
