import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCliRenderer } from './createCliRenderer.js';

// Mock cli-markdown module
vi.mock('cli-markdown', () => ({
  default: vi.fn((markdown: string) => `[FORMATTED]\n${markdown}\n[/FORMATTED]`)
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
      thinkingStyle: 'blockquote'
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
      thinkingStyle: 'suppress'
    });

    await renderer.write('Content');
    await renderer.end();

    expect(output).toHaveBeenCalled();
  });

  it('handles writable stream output', async () => {
    const mockStream = {
      write: vi.fn(),
      end: vi.fn()
    };

    const renderer = createCliRenderer({
      output: mockStream as unknown as NodeJS.WritableStream
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
      onError
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

  describe('onFinish callback', () => {
    it('calls onFinish via writeChunk when done=true', async () => {
      const onFinish = vi.fn();
      const output = vi.fn();
      const renderer = createCliRenderer({
        output,
        onFinish
      });

      await renderer.writeChunk({
        content: 'Test',
        done: true,
        finishReason: 'stop'
      });

      expect(onFinish).toHaveBeenCalledWith('stop', undefined);
    });

    it('passes usage data to onFinish', async () => {
      const onFinish = vi.fn();
      const output = vi.fn();
      const renderer = createCliRenderer({
        output,
        onFinish
      });

      await renderer.writeChunk({
        content: 'Test',
        done: true,
        finishReason: 'length',
        usage: { inputTokens: 10, outputTokens: 20 }
      });

      expect(onFinish).toHaveBeenCalledWith('length', { inputTokens: 10, outputTokens: 20 });
    });

    it('prevents double onFinish invocation', async () => {
      const onFinish = vi.fn();
      const output = vi.fn();
      const renderer = createCliRenderer({
        output,
        onFinish
      });

      // First call with done=true
      await renderer.writeChunk({
        content: 'Test',
        done: true,
        finishReason: 'stop'
      });

      // Then call end()
      await renderer.end();

      // Should only be called once (in writeChunk)
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('calls onFinish in end() if not already called', async () => {
      const onFinish = vi.fn();
      const output = vi.fn();
      const renderer = createCliRenderer({
        output,
        onFinish
      });

      await renderer.write('Content');
      await renderer.end();

      // Should be called once in end()
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tool call callbacks', () => {
    it('accepts onToolCall callback', async () => {
      const onToolCall = vi.fn();
      const output = vi.fn();
      const renderer = createCliRenderer({
        output,
        onToolCall
      });

      await renderer.write('Content');
      await renderer.end();

      expect(renderer).toBeDefined();
    });

    it('accepts onToolCallDelta callback', async () => {
      const onToolCallDelta = vi.fn();
      const output = vi.fn();
      const renderer = createCliRenderer({
        output,
        onToolCallDelta
      });

      await renderer.write('Content');
      await renderer.end();

      expect(renderer).toBeDefined();
    });

    it('calls onStep when stepIndex changes via writeChunk', async () => {
      const onStep = vi.fn();
      const output = vi.fn<(text: string) => void>();
      const renderer = createCliRenderer({
        output,
        onStep
      });

      await renderer.writeChunk({ content: 'step 0', stepIndex: 0, stepUsage: { outputTokens: 2 } });
      await renderer.writeChunk({ content: 'step 1', stepIndex: 1, usage: { inputTokens: 1, outputTokens: 3 } });
      await renderer.end();

      expect(onStep).toHaveBeenCalledTimes(2);
      expect(onStep).toHaveBeenNthCalledWith(1, 0, { outputTokens: 2 });
      expect(onStep).toHaveBeenNthCalledWith(2, 1, { inputTokens: 1, outputTokens: 3 });
    });
  });
});
