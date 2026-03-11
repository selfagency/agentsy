import { describe, expect, it } from 'vitest';

import { processStream } from './generic.js';

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) {
    out.push(item);
  }
  return out;
}

describe('processStream', () => {
  it('skips empty processor outputs for empty input chunks', async () => {
    async function* source() {
      yield {};
      yield { content: 'hello' };
      yield {};
    }

    const out = await collect(processStream(source()));
    expect(out).toHaveLength(1);
    expect(out[0]?.content).toBe('hello');
  });
});
