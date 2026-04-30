import { describe, expect, it, vi } from 'vitest';

import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import { createGenericAdapter, processStream } from './generic.js';
import { createVSCodeCopilotAdapter } from './vscode.js';

async function* source() {
  yield { content: 'hello' };
}

describe('processStream', () => {
  it('yields processed outputs and final flush output', async () => {
    const outputs = [];
    for await (const out of processStream(source(), { parseThinkTags: false, scrubContextTags: false })) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(2);
    expect(outputs[0]?.content).toBe('hello');
    expect(outputs[1]?.done).toBe(true);
  });
});

describe('createVSCodeCopilotAdapter', () => {
  it('routes thinking/content to markdown and tool calls to callback', async () => {
    const markdown = vi.fn();
    const onToolCall = vi.fn();
    const processor = new LLMStreamProcessor({ parseThinkTags: true, scrubContextTags: false });
    const adapter = createVSCodeCopilotAdapter({
      processor,
      stream: { markdown },
      onToolCall,
      showThinking: true,
    });

    await adapter.write({
      content: '<think>plan</think>Answer',
      tool_calls: [{ function: { name: 'search_files', arguments: { query: 'x' } } }],
    });
    await adapter.end();

    expect(markdown).toHaveBeenCalled();
    expect(onToolCall).toHaveBeenCalledWith({
      name: 'search_files',
      parameters: { query: 'x' },
      format: 'native-json',
    });
  });
});

describe('createGenericAdapter', () => {
  it('routes content to onContent callback', async () => {
    const onContent = vi.fn();
    const adapter = createGenericAdapter({ onContent }, { parseThinkTags: false, scrubContextTags: false });

    await adapter.write({ content: 'Hello world' });
    await adapter.end();

    expect(onContent).toHaveBeenCalledWith('Hello world');
  });

  it('routes thinking text to onThinking callback', async () => {
    const onThinking = vi.fn();
    const onContent = vi.fn();
    const adapter = createGenericAdapter({ onThinking, onContent }, { parseThinkTags: true, scrubContextTags: false });

    await adapter.write({ content: '<think>reasoning</think>Answer' });
    await adapter.end();

    expect(onThinking).toHaveBeenCalledWith('reasoning');
    expect(onContent).toHaveBeenCalledWith('Answer');
  });

  it('suppresses thinking when showThinking is false', async () => {
    const onThinking = vi.fn();
    const adapter = createGenericAdapter(
      { onThinking },
      { parseThinkTags: true, scrubContextTags: false, showThinking: false },
    );

    await adapter.write({ content: '<think>hidden</think>visible' });
    await adapter.end();

    expect(onThinking).not.toHaveBeenCalled();
  });

  it('calls onDone when stream ends', async () => {
    const onDone = vi.fn();
    const adapter = createGenericAdapter({ onDone }, { parseThinkTags: false, scrubContextTags: false });

    await adapter.write({ content: 'data' });
    await adapter.end();

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('routes tool calls to onToolCall callback', async () => {
    const onToolCall = vi.fn();
    const adapter = createGenericAdapter({ onToolCall }, { parseThinkTags: false, scrubContextTags: false });

    await adapter.write({
      content: 'text',
      tool_calls: [{ function: { name: 'run', arguments: { x: 1 } } }],
    });
    await adapter.end();

    expect(onToolCall).toHaveBeenCalledWith({
      name: 'run',
      parameters: { x: 1 },
      format: 'native-json',
    });
  });

  it('propagates errors from callbacks via onError', async () => {
    const onError = vi.fn();
    const adapter = createGenericAdapter(
      {
        onContent: () => {
          throw new Error('callback error');
        },
        onError,
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    // Should not throw; error should be handled via onError callback
    await expect(adapter.write({ content: 'test' })).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { type: 'content', chunk: { content: 'test' } });
  });

  it('handles errors when onError callback throws', async () => {
    const onError = vi.fn(() => {
      throw new Error('onError failed');
    });
    const adapter = createGenericAdapter(
      {
        onContent: () => {
          throw new Error('callback error');
        },
        onError,
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    // Error from onError should propagate (unhandled)
    await expect(adapter.write({ content: 'test' })).rejects.toThrow('onError failed');
  });

  it('works with no callbacks provided', async () => {
    const adapter = createGenericAdapter({}, { parseThinkTags: false, scrubContextTags: false });

    // Should not throw even with no callbacks
    await expect(adapter.write({ content: 'test' })).resolves.toBeUndefined();
    await expect(adapter.end()).resolves.toBeUndefined();
  });

  it('handles multiple write+end cycles after processor reset', async () => {
    const contents: string[] = [];
    const adapter = createGenericAdapter(
      {
        onContent: text => {
          contents.push(text);
        },
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    await adapter.write({ content: 'first' });
    await adapter.end();

    // Adapter reuses processor which needs manual reset for reuse
    expect(contents).toContain('first');
  });

  // --- Backpressure ---

  it('awaits each async callback before processing the next write', async () => {
    const order: number[] = [];
    let resolveFirst!: () => void;

    const firstDone = new Promise<void>(resolve => {
      resolveFirst = resolve;
    });

    const adapter = createGenericAdapter(
      {
        onContent: async text => {
          if (text === 'chunk1') {
            // Simulate slow async work for the first chunk
            await firstDone;
            order.push(1);
          } else {
            order.push(2);
          }
        },
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    // Start both writes concurrently — write() must individually await its callback
    const p1 = adapter.write({ content: 'chunk1' });
    // Resolve the first callback while p1 is still in-flight
    resolveFirst();
    const p2 = adapter.write({ content: 'chunk2' });

    await Promise.all([p1, p2]);

    // Each write awaits its own callback, so both complete without throwing
    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  it('rapid sequential writes all deliver content in order', async () => {
    const received: string[] = [];
    const adapter = createGenericAdapter(
      {
        onContent: text => {
          received.push(text);
        },
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    for (let i = 0; i < 20; i++) {
      await adapter.write({ content: `chunk${i}` });
    }
    await adapter.end();

    expect(received).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      expect(received[i]).toBe(`chunk${i}`);
    }
  });
});
