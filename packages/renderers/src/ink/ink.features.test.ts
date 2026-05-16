import { LLMStreamProcessor } from '@agentsy/core/processor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInkRenderer } from './createInkRenderer.js';
import { darkTheme } from './themes/index.js';

vi.mock(import('cli-markdown'), () => ({
  default: vi.fn((markdown: string) => `[ANSI:${markdown}]`)
}));

vi.mock(import('ink'), async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    render: vi.fn((_component: React.ReactElement) => ({
      clear: vi.fn(),
      lastFrame: () => '[mock frame]',
      rerender: vi.fn(),
      unmount: vi.fn()
    }))
  };
});

describe('Ink Renderer features', () => {
  let processor: LLMStreamProcessor;
  let onWarning: (message: string, context?: Record<string, unknown>) => void;
  let onFinish: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    onWarning = vi.fn();
    onFinish = vi.fn();
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

  describe('Syntax Highlighting option', () => {
    it('processes syntaxHighlight: true option', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        syntaxHighlight: true
      });

      processor.process({ content: '```javascript\nconst x = 42;\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('disables syntax highlighting when false', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        syntaxHighlight: false
      });

      processor.process({ content: '```javascript\nconst x = 42;\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('handles multiple code fences', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        syntaxHighlight: true
      });

      processor.process({
        content: 'First block:\n```ts\nconst a = 1;\n```\n\nSecond block:\n```python\nb = 2\n```'
      });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('gracefully handles unsupported language', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        syntaxHighlight: true
      });

      processor.process({ content: '```unknownlang\nfoo bar baz\n```' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Keyboard callbacks', () => {
    it('onInterrupt callback is accepted when enabled', async () => {
      const onInterrupt = vi.fn();

      const renderer = await createInkRenderer({
        keyboard: {
          enabled: true,
          onInterrupt
        },
        onFinish,
        onWarning,
        processor
      });

      processor.process({ content: 'Text' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('onCancel callback is accepted when enabled', async () => {
      const onCancel = vi.fn();

      const renderer = await createInkRenderer({
        keyboard: {
          enabled: true,
          onCancel
        },
        onFinish,
        onWarning,
        processor
      });

      processor.process({ content: 'Text' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Spinner interval configuration', () => {
    it('respects spinnerIntervalMs in thinking theme', async () => {
      const customTheme = {
        ...darkTheme,
        thinking: { ...darkTheme.thinking, spinnerIntervalMs: 50 }
      };

      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        showThinking: true,
        theme: customTheme
      });

      processor.process({ content: '<thinking>Fast spinner</thinking>' });
      processor.process({ content: 'Main output' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('respects spinnerIntervalMs in toolCall theme', async () => {
      const customTheme = {
        ...darkTheme,
        toolCall: { ...darkTheme.toolCall, spinnerIntervalMs: 100 }
      };

      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        showToolCalls: true,
        theme: customTheme
      });

      processor.process({ content: 'Text' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('falls back to default interval when not specified', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        showThinking: true,
        theme: darkTheme
      });

      processor.process({ content: '<thinking>Default speed</thinking>' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });
  });

  describe('Multiple content streams', () => {
    it('handles mixed thinking and text', async () => {
      const renderer = await createInkRenderer({
        markdown: true,
        onFinish,
        onWarning,
        processor,
        showThinking: true
      });

      processor.process({ content: '<thinking>Processing...' });
      processor.process({ content: ' nearly done</thinking>' });
      processor.process({ content: 'User response: Hello' });
      processor.process({ done: true });

      expect(onFinish).toHaveBeenCalledWith();
      renderer.unmount();
    });

    it('handles tool calls', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor,
        showToolCalls: true
      });

      processor.process({
        content: '<tool_call id="1" name="search"><arguments>{"query":"test"}</arguments></tool_call>'
      });
      processor.process({ content: 'Search results...' });
      processor.process({ done: true });

      expect(renderer.instance).toBeDefined();
      renderer.unmount();
    });

    it('handles empty, long, and special content', async () => {
      const renderer = await createInkRenderer({
        onFinish,
        onWarning,
        processor
      });

      processor.process({ content: '' });
      processor.process({ content: 'Word '.repeat(1000) });
      processor.process({ content: 'Text with <brackets> & symbols © ™ ®' });
      processor.process({ done: true });

      expect(onFinish).toHaveBeenCalledWith();
      renderer.unmount();
    });
  });
});
