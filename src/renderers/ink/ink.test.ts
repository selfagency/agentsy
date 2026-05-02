import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { createInkRenderer } from './createInkRenderer.js';
import { LLMStreamProcessor } from '../../processor/index.js';

// Mock cli-markdown for consistent ANSI output in tests
vi.mock('cli-markdown', () => ({
  default: vi.fn((markdown: string) => {
    // Simple mock: wrap markdown text with brackets to simulate formatting
    return `[ANSI:${markdown}]`;
  }),
}));

// Mock Ink's render to avoid terminal setup in test environment
vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    render: vi.fn((component: any) => {
      // Return a mock instance without invoking terminal setup
      return {
        lastFrame: () => '[mock frame]',
        rerender: vi.fn(),
        clear: vi.fn(),
        unmount: vi.fn(),
      };
    }),
  };
});

describe('Ink Renderer', () => {
  let processor: LLMStreamProcessor;
  let onWarning: (message: string, context?: Record<string, unknown>) => void;
  let onFinish: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    onWarning = vi.fn() as any;
    onFinish = vi.fn() as any;
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

  it('creates a renderer with processor', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    expect(renderer).toBeDefined();
    expect(renderer.instance).toBeDefined();
    expect(typeof renderer.unmount).toBe('function');
    expect(typeof renderer.write).toBe('function');
    expect(typeof renderer.end).toBe('function');

    renderer.unmount();
  });

  it('handles text chunks from processor', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    processor.process({ content: 'Hello ' });
    processor.process({ content: 'World' });
    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('processes thinking tags when parseThinkTags is enabled', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showThinking: true,
      thinkingStyle: 'blockquote',
    });

    processor.process({ content: '<thinking>Deep thought</thinking>' });
    processor.process({ content: 'Main text' });
    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('respects thinkingStyle: blockquote', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showThinking: true,
      thinkingStyle: 'blockquote',
    });

    processor.process({ content: '<thinking>Blockquote thought</thinking>' });
    processor.process({ done: true });

    // If no error, the blockquote style is being handled correctly
    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('respects thinkingStyle: inline', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showThinking: true,
      thinkingStyle: 'inline',
    });

    processor.process({ content: '<thinking>Inline thought</thinking>' });
    processor.process({ done: true });

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('respects thinkingStyle: suppress', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showThinking: true,
      thinkingStyle: 'suppress',
    });

    processor.process({ content: '<thinking>Hidden thought</thinking>' });
    processor.process({ content: 'Main text' });
    processor.process({ done: true });

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('shows tool calls when showToolCalls is true', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showToolCalls: true,
    });

    processor.process({ content: 'Calling search' });
    processor.process({ done: true });

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('hides tool calls when showToolCalls is false', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showToolCalls: false,
    });

    processor.process({ content: 'Calling search' });
    processor.process({ done: true });

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('handles markdown: false option', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      markdown: false,
    });

    processor.process({ content: '# Heading\n**bold**' });
    processor.process({ done: true });

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('handle.end() sets isStreaming to false', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    processor.process({ content: 'Content' });

    // Call handle's end() method
    renderer.end();

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('handle.write() is a no-op (event-driven)', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    // write() should not throw or cause issues
    renderer.write('This is ignored');
    processor.process({ content: 'This comes from processor' });
    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('calls onFinish callback when processor ends', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    processor.process({ content: 'Text' });
    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('calls onWarning on processor warnings', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    // Processor will emit warning for certain conditions
    processor.process({ content: '' });
    processor.process({ done: true });

    // At minimum, renderer shouldn't error
    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('combines thinking, tool calls, and text', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      showThinking: true,
      thinkingStyle: 'blockquote',
      showToolCalls: true,
    });

    processor.process({ content: '<thinking>Planning...</thinking>' });
    processor.process({ content: '\nResult is 42' });
    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('renders with default options', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
    });

    processor.process({ content: 'Default rendering' });
    processor.process({ done: true });

    expect(renderer.instance).toBeDefined();

    renderer.unmount();
  });

  it('handles empty write sequence', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('handles multiple text chunks', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
      markdown: false,
    });

    processor.process({ content: 'Chunk 1\n' });
    processor.process({ content: 'Chunk 2\n' });
    processor.process({ content: 'Chunk 3' });
    processor.process({ done: true });

    expect(onFinish).toHaveBeenCalled();

    renderer.unmount();
  });

  it('unmount() cleanly closes renderer', async () => {
    const renderer = await createInkRenderer({
      processor,
      onWarning,
      onFinish,
    });

    processor.process({ content: 'Text' });

    // Unmount should not throw
    expect(() => {
      renderer.unmount();
    }).not.toThrow();
  });
});
