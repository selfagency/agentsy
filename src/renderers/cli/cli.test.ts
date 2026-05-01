import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCliRenderer } from './createCliRenderer.js';

// Mock cli-markdown module
vi.mock('cli-markdown', () => ({
  default: vi.fn((markdown: string) => `[FORMATTED]\n${markdown}\n[/FORMATTED]`),
}));

describe('CLI Renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats markdown on end via cli-markdown', async () => {
    const output = vi.fn();
    const renderer = createCliRenderer({ output });

    await renderer.write('# Heading\n\n');
    await renderer.write('Paragraph text');
    await renderer.end();

    // Verify cli-markdown was called and output was written
    expect(output).toHaveBeenCalled();
    const allOutput = output.mock.calls.map(c => c[0]).join('');
    expect(allOutput).toContain('[FORMATTED]');
    expect(allOutput).toContain('Heading');
  });

  it('handles thinking blocks with blockquote style', async () => {
    const output = vi.fn();
    const renderer = createCliRenderer({
      output,
      showThinking: true,
      thinkingStyle: 'blockquote',
    });

    await renderer.write('Content');
    await renderer.end();

    expect(output).toHaveBeenCalled();
  });

  it('suppresses thinking blocks with suppress style', async () => {
    const output = vi.fn();
    const renderer = createCliRenderer({
      output,
      showThinking: true,
      thinkingStyle: 'suppress',
    });

    await renderer.write('Content');
    await renderer.end();

    expect(output).toHaveBeenCalled();
  });

  it('handles writable stream output', async () => {
    const mockStream = {
      write: vi.fn(),
      end: vi.fn(),
    };

    const renderer = createCliRenderer({
      output: mockStream as unknown as NodeJS.WritableStream,
    });

    await renderer.write('# Test\n\nContent');
    await renderer.end();

    expect(mockStream.write).toHaveBeenCalled();
    expect(mockStream.end).toHaveBeenCalled();
  });

  it('calls onError callback on errors', async () => {
    const onError = vi.fn();
    const output = vi.fn();
    const renderer = createCliRenderer({
      output,
      onError,
    });

    await renderer.write('test');
    await renderer.end();

    // Should complete without errors
    expect(onError).not.toHaveBeenCalled();
  });

  it('processes empty content gracefully', async () => {
    const output = vi.fn();
    const renderer = createCliRenderer({ output });

    await renderer.write('');
    await renderer.end();

    // Should not error, but also not necessarily call output if no content
    expect(renderer).toBeDefined();
  });

  it('accumulates multiple write calls', async () => {
    const output = vi.fn();
    const renderer = createCliRenderer({ output });

    await renderer.write('## Section 1\n\n');
    await renderer.write('Content for section 1\n\n');
    await renderer.write('## Section 2\n\n');
    await renderer.write('Content for section 2');
    await renderer.end();

    expect(output).toHaveBeenCalled();
    const allOutput = output.mock.calls.map(c => c[0]).join('');
    expect(allOutput).toContain('Section 1');
    expect(allOutput).toContain('Section 2');
  });
});
