/**
 * Helper for instrumenting `ReadableStream` lifecycles. The gateway
 * records metrics on stream start and on first byte received so
 * time-to-first-byte (TTFB) and total stream duration are both
 * captured. The consumer of the stream does not need to do
 * anything; the tracker wraps the stream transparently.
 */

export interface StreamMetricSummary {
  /** Number of chunks delivered to the consumer. */
  chunkCount: number;
  /** Total wall-clock time from stream construction to stream close, in ms. */
  durationMs: number;
  /** Time from stream construction to the first byte delivered, in ms. */
  ttfbMs: number;
}

export interface InstrumentedStreamHandle<T> {
  /**
   * Resolves when the stream closes normally, errors, or is
   * cancelled. The resolution carries the timing summary (or
   * rejects with the error on stream failure).
   */
  closed: Promise<StreamMetricSummary>;
  /**
   * The wrapped stream. The consumer pulls from this exactly as
   * they would from the source. Internally we forward every chunk
   * through a `TransformStream` so lifecycle events are observed.
   */
  stream: ReadableStream<T>;
}

/**
 * Wrap a `ReadableStream<T>` so that lifecycle events (TTFB, total
 * duration, chunk count) can be reported to a `MetricsCollector`.
 * The wrapped stream behaves identically from the consumer's
 * perspective; the tracker is a passive observer.
 *
 * Implementation: we pipe the source through a `TransformStream`
 * that records the first-byte timestamp and increments the chunk
 * counter on every chunk. The wrapped stream is the readable side
 * of the transform; the consumer pulls from it.
 */
export function instrumentStream<T>(source: ReadableStream<T>): InstrumentedStreamHandle<T> {
  const startedAt = Date.now();
  let firstByteAt: number | undefined;
  let chunkCount = 0;

  let resolveClosed: ((summary: StreamMetricSummary) => void) | undefined;
  let rejectClosed: ((error: unknown) => void) | undefined;
  const closed = new Promise<StreamMetricSummary>((resolve, reject) => {
    resolveClosed = resolve;
    rejectClosed = reject;
  });

  const transform = new TransformStream<T, T>({
    transform(chunk, controller) {
      firstByteAt ??= Date.now();
      chunkCount += 1;
      controller.enqueue(chunk);
    },
    flush() {
      if (resolveClosed === undefined) {
        return;
      }
      const summary: StreamMetricSummary = {
        chunkCount,
        durationMs: Date.now() - startedAt,
        ttfbMs: firstByteAt === undefined ? 0 : firstByteAt - startedAt
      };
      resolveClosed(summary);
    }
  });

  // Pipe the source through the transform. If the source errors,
  // surface the error on `closed`.
  source.pipeTo(transform.writable).catch(error => {
    rejectClosed?.(error);
  });

  return { closed, stream: transform.readable };
}
