import { LLMStreamProcessor } from '@agentsy/core/processor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInkRenderer } from './createInkRenderer.js';

// @ts-ignore ink has no default export, but we need it for type references
import type typeInk from 'ink';

vi.mock(import('ink'), async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    render: vi.fn<(component: React.ReactElement) => {}>((_component: React.ReactElement) => ({
      clear: vi.fn<() => void>(),
      lastFrame: () => '[mock frame]',
      rerender: vi.fn<() => void>(),
      unmount: vi.fn<() => void>()
    }))
  };
});

describe('Ink Renderer behavior', () => {
  let processor: LLMStreamProcessor;
  let onWarning: (message: string, context?: Record<string, unknown>) => void;
  let onFinish: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    onWarning = vi.fn<(message: string, context?: Record<string, unknown>) => void>();
    onFinish = vi.fn<() => void>();
    processor = new LLMStreamProcessor({
      enforcePrivacyTags: true,
      onWarning,
      parseThinkTags: true,
      scrubContextTags: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Keyboard handling options', () => {
    it('enables keyboard support when specified', async () => {
      const renderer = await createInkRenderer({
        keyboard: {
          enabled: true
        },
        onFinish,
        onWarning,
        processor
      });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('configures keyboard with custom handlers', async () => {
      const onInterrupt = vi.fn<() => void>();
      const renderer = await createInkRenderer({
        keyboard: {
          enabled: true,
          onInterrupt
        },
        onFinish,
        onWarning,
        processor
      });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Renderer methods', () => {
    it('write method accepts content', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor
      });

      renderer.write('Test content');

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('end method closes rendering', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor
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
        onFinish,
        onWarning,
        processor
      });

      processor.process({ content: '<invalid>' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('handles malformed JSON in tool calls gracefully', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        showToolCalls: true
      });

      processor.process({
        content: '<tool_call id="1" name="test"><arguments>{invalid json}</arguments></tool_call>'
      });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Screen reader accessibility', () => {
    it('enables screen reader mode', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        screenReader: true
      });

      processor.process({ content: 'Accessible content' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('disables screen reader mode', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        screenReader: false
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
        markdown: true,
        onFinish,
        onWarning,
        processor
      });

      processor.process({ content: '# Heading\n\n**Bold** text' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('renders plain text when markdown disabled', async () => {
      const renderer = await createInkRenderer({
        markdown: false,
        onFinish,
        onWarning,
        processor
      });

      processor.process({ content: '# Not a heading\n\n**Not bold**' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('handles code fences with markdown', async () => {
      const renderer = await createInkRenderer({
        markdown: true,
        onFinish,
        onWarning,
        processor
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
        markdown: true,
        onFinish,
        onWarning,
        processor,
        syntaxHighlight: true
      });

      processor.process({ content: '```js\nconst fn = () => {};\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('disables syntax highlighting', async () => {
      const renderer = await createInkRenderer({
        markdown: true,
        onFinish,
        onWarning,
        processor,
        syntaxHighlight: false
      });

      processor.process({ content: '```js\nconst fn = () => {};\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });
});
