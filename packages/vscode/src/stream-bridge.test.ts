import { describe, expect, it, vi } from 'vitest';
import type { StreamChunk } from '@agentsy/processor';
import { VSCodeStreamBridge, bridgeStream } from './stream-bridge.js';

describe('VSCodeStreamBridge', () => {
  it('writes mapped chunks in order and calls onRawChunk first', async () => {
    const calls: string[] = [];
    const onRawChunk = vi.fn(async (_chunk: StreamChunk) => {
      calls.push('raw');
    });
    const onChunk = vi.fn(async () => {
      calls.push('chunk');
    });

    const bridge = new VSCodeStreamBridge({ onRawChunk, onChunk });
    await bridge.write({ content: 'hello', thinking: 'reason' });

    expect(onRawChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(calls[0]).toBe('raw');
  });

  it('works without onRawChunk', async () => {
    const onChunk = vi.fn();
    const bridge = new VSCodeStreamBridge({ onChunk });

    await bridge.write({ content: 'hello' });
    expect(onChunk).toHaveBeenCalledTimes(1);
  });
});

describe('bridgeStream', () => {
  it('yields mapped VS Code chunks from stream source', async () => {
    async function* source(): AsyncIterable<StreamChunk> {
      yield { content: 'a' };
      yield { thinking: 'b' };
    }

    const out = [];
    for await (const chunk of bridgeStream(source())) {
      out.push(chunk);
    }

    expect(out).toEqual([
      { part: { type: 'text', value: 'a' } },
      { part: { type: 'text', value: '<think>b</think>\n' } },
    ]);
  });
});
