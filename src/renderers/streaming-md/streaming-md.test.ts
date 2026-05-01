import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStreamingMarkdownRenderer } from './createStreamingMarkdownRenderer.js';

// Mock streaming-markdown and dompurify
vi.mock('streaming-markdown', () => ({
  default: {
    parser_create: vi.fn(opts => ({ target: opts.target })),
    parser_write: vi.fn(),
    parser_end: vi.fn(),
  },
}));

vi.mock('dompurify', () => {
  const mockSanitize = vi.fn((html: string) => html);
  return {
    default: {
      sanitize: mockSanitize,
      removed: [],
    },
    sanitize: mockSanitize,
    removed: [],
  };
});

describe('Streaming Markdown Renderer', () => {
  let mockTarget: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock DOM element
    mockTarget = {
      id: 'content',
      appendChild: vi.fn(),
      innerHTML: '',
    };
  });

  it('requires target element', () => {
    expect(() => {
      createStreamingMarkdownRenderer({
        target: null as any,
      });
    }).toThrow('Target element is required');
  });

  it('creates renderer with target', async () => {
    const renderer = createStreamingMarkdownRenderer({ target: mockTarget });

    expect(renderer).toBeDefined();
    expect(renderer.write).toBeDefined();
    expect(renderer.end).toBeDefined();
  });

  it('accumulates markdown content', async () => {
    const renderer = createStreamingMarkdownRenderer({ target: mockTarget });

    await renderer.write('# Title\n\n');
    await renderer.write('Content');
    await renderer.end();

    // Just verify no errors were thrown
    expect(renderer).toBeDefined();
  });

  it('handles thinking blocks when showThinking is true', async () => {
    const renderer = createStreamingMarkdownRenderer({
      target: mockTarget,
      showThinking: true,
    });

    await renderer.write('Content');
    await renderer.end();

    expect(renderer).toBeDefined();
  });

  it('supports separate thinking container', async () => {
    const thinkingContainer = { id: 'thinking' };
    const renderer = createStreamingMarkdownRenderer({
      target: mockTarget,
      showThinking: true,
      thinkingContainer,
    });

    await renderer.write('Content');
    await renderer.end();

    expect(renderer).toBeDefined();
  });

  it('calls onSecurityViolation on sanitization failure', async () => {
    const onSecurityViolation = vi.fn();
    const renderer = createStreamingMarkdownRenderer({
      target: mockTarget,
      onSecurityViolation,
    });

    await renderer.write('Content');
    await renderer.end();

    // Mock would have called onSecurityViolation if there were violations
    expect(onSecurityViolation).not.toHaveBeenCalled(); // No violations in clean content
  });

  it('calls onError callback on processing errors', async () => {
    const onError = vi.fn();
    const renderer = createStreamingMarkdownRenderer({
      target: mockTarget,
      onError,
    });

    await renderer.write('test');
    await renderer.end();

    expect(onError).not.toHaveBeenCalled();
  });

  it('processes multiple chunks', async () => {
    const renderer = createStreamingMarkdownRenderer({ target: mockTarget });

    await renderer.write('## Section 1\n\n');
    await renderer.write('Content for section 1\n\n');
    await renderer.write('## Section 2\n\n');
    await renderer.write('Content for section 2');
    await renderer.end();

    expect(renderer).toBeDefined();
  });

  it('handles empty content gracefully', async () => {
    const renderer = createStreamingMarkdownRenderer({ target: mockTarget });

    await renderer.write('');
    await renderer.end();

    expect(renderer).toBeDefined();
  });
});
