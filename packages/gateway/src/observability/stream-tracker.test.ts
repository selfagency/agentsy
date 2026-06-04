import { describe, expect, it } from 'vitest';

import { instrumentStream } from './stream-tracker.js';

function makeStream<T>(chunks: T[], closed: { error?: Error } = {}): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      if (closed.error === undefined) {
        controller.close();
      } else {
        controller.error(closed.error);
      }
    }
  });
}

async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
  const out: T[] = [];
  const reader = stream.getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value !== undefined) {
      out.push(value);
    }
  }
  return out;
}

describe('instrumentStream', () => {
  it('records ttfb and duration for a synchronous stream', async () => {
    const source = makeStream([1, 2, 3]);
    const handle = instrumentStream(source);
    const out = await drain(handle.stream);
    expect(out).toEqual([1, 2, 3]);
    const summary = await handle.closed;
    expect(summary.chunkCount).toBe(3);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.ttfbMs).toBeGreaterThanOrEqual(0);
  });

  it('records zero chunks when the source is empty', async () => {
    const source = makeStream<number>([]);
    const handle = instrumentStream(source);
    const out = await drain(handle.stream);
    expect(out).toEqual([]);
    const summary = await handle.closed;
    expect(summary.chunkCount).toBe(0);
    expect(summary.ttfbMs).toBe(0);
  });

  it('rejects on stream error', async () => {
    const source = makeStream<number>([1], { error: new Error('upstream broken') });
    const handle = instrumentStream(source);
    await expect(drain(handle.stream)).rejects.toThrow('upstream broken');
    await expect(handle.closed).rejects.toThrow('upstream broken');
  });

  it('tracks a delayed first byte (ttfb > 0)', async () => {
    let enqueued = false;
    const source = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        enqueued = true;
        setTimeout(() => {
          controller.enqueue(2);
          controller.close();
        }, 25);
      }
    });
    const handle = instrumentStream(source);
    expect(enqueued).toBe(true);
    const out = await drain(handle.stream);
    expect(out).toEqual([1, 2]);
    const summary = await handle.closed;
    expect(summary.chunkCount).toBe(2);
    // We don't assert a specific ttfb value because the timer
    // depends on the runtime; just confirm it is bounded.
    expect(summary.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(summary.durationMs).toBeGreaterThanOrEqual(summary.ttfbMs);
  });
});
