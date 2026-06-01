import type { StreamChunk } from '@agentsy/core/processor';
import { describe, expect, it, vi } from 'vitest';
import type { LanguageModelChatResponseChunk } from './provider/base-language-model-chat-provider.js';
import { bridgeStream, VSCodeStreamBridge } from './stream-bridge.js';

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncIterable return type
async function* sourceChunks(): AsyncIterable<StreamChunk> {
  yield { content: 'a' };
  yield { thinking: 'b' };
}

describe(VSCodeStreamBridge, () => {
  it('writes mapped chunks in order and calls onRawChunk first', async () => {
    const calls: string[] = [];
    const onRawChunk = vi.fn((_chunk: StreamChunk) => {
      calls.push('raw');
    });
    const onChunk = vi.fn(() => {
      calls.push('chunk');
    });

    const bridge = new VSCodeStreamBridge({ onChunk, onRawChunk });
    await bridge.write({ content: 'hello', thinking: 'reason' });

    expect(onRawChunk).toHaveBeenCalledOnce();
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(calls[0]).toBe('raw');
  });

  it('works without onRawChunk', async () => {
    const onChunk = vi.fn();
    const bridge = new VSCodeStreamBridge({ onChunk });

    await bridge.write({ content: 'hello' });
    expect(onChunk).toHaveBeenCalledOnce();
  });
});

describe(bridgeStream, () => {
  it('yields mapped VS Code chunks from stream source', async () => {
    const out: LanguageModelChatResponseChunk[] = [];
    for await (const chunk of bridgeStream(sourceChunks())) {
      out.push(chunk);
    }

    expect(out).toStrictEqual([
      { part: { type: 'text', value: 'a' } },
      { part: { type: 'text', value: '<think>b</think>\n' } }
    ]);
  });
});
