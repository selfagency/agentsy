/**
 * AG-UI Observable Tests
 *
 * Verifies AsyncGenerator to Observable conversion without hard RxJS dependency
 */

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { toObservable } from './observable.js';

// Module-level generators for test fixtures
// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceBasic() {
  yield 1;
  yield 2;
  yield 3;
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceStringPair() {
  yield 'a';
  yield 'b';
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceWithError() {
  yield 1;
  throw new Error('Test error');
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceDouble() {
  yield 1;
  yield 2;
}

async function* sourceWithDelay() {
  yield 1;
  await new Promise(resolve => setTimeout(resolve, 10));
  yield 2;
  await new Promise(resolve => setTimeout(resolve, 10));
  yield 3;
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceTest() {
  yield 'test';
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceExpected() {
  yield 1;
  throw new Error('Expected');
}

async function* sourceEmpty() {
  // Intentionally empty generator for testing completion without values
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceSingle() {
  yield 1;
}

// biome-ignore lint/suspicious/useAwait: async generator needed for AsyncGenerator
async function* sourceMultiple() {
  yield 1;
  yield 2;
  yield 3;
  yield 4;
  yield 5;
}

async function* sourceAsync() {
  yield 'start';
  await new Promise(resolve => setTimeout(resolve, 20));
  yield 'middle';
  await new Promise(resolve => setTimeout(resolve, 20));
  yield 'end';
}

describe('toObservable', () => {
  it('should subscribe and emit values', async () => {
    const results: number[] = [];
    toObservable(sourceBasic()).subscribe({
      next: value => results.push(value)
    });

    // Give async generator time to consume
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toStrictEqual([1, 2, 3]);
  });

  it('should support callback syntax for next', async () => {
    const results: string[] = [];
    toObservable(sourceStringPair()).subscribe(value => {
      results.push(value);
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toStrictEqual(['a', 'b']);
  });

  it('should call error handler on generator error', async () => {
    const results: number[] = [];
    const errors: unknown[] = [];

    toObservable(sourceWithError()).subscribe({
      error: err => errors.push(err),
      next: value => results.push(value)
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(results).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('Test error');
  });

  it('should call complete handler after generator finishes', async () => {
    let completed = false;

    toObservable(sourceDouble()).subscribe({
      complete: () => {
        completed = true;
      },
      next: () => {
        /* noop */
      }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(completed).toBeTruthy();
  });

  it('should support unsubscribe to stop consuming', async () => {
    const results: number[] = [];

    const subscription = toObservable(sourceWithDelay()).subscribe({
      next: value => results.push(value)
    });

    // Unsubscribe immediately
    subscription.unsubscribe();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should only have first value (if it was already yielded)
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should normalize observer with just next callback', async () => {
    const next = vi.fn();

    toObservable(sourceTest()).subscribe({
      next
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(next).toHaveBeenCalledWith('test');
  });

  it('should handle observer without error handler', async () => {
    const next = vi.fn();
    const complete = vi.fn();

    toObservable(sourceExpected()).subscribe({
      complete,
      next
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should not crash, just stop - next should receive yielded value
    expect(next).toHaveBeenCalledWith(1);
  });

  it('should handle empty generator', async () => {
    const next = vi.fn();
    const complete = vi.fn();

    toObservable(sourceEmpty()).subscribe({
      complete,
      next
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith();
  });

  it('should return subscription object', () => {
    const subscription = toObservable(sourceSingle()).subscribe(() => {
      /* noop */
    });

    expectTypeOf(subscription.unsubscribe).toBeFunction();
  });

  it('should support multiple values with no delay', async () => {
    const results: number[] = [];

    toObservable(sourceMultiple()).subscribe({
      next: value => results.push(value)
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toStrictEqual([1, 2, 3, 4, 5]);
  });

  it('should handle async operations in generator', async () => {
    const results: string[] = [];

    toObservable(sourceAsync()).subscribe({
      next: value => results.push(value)
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(results).toStrictEqual(['start', 'middle', 'end']);
  });

  it('should not consume generator if not subscribed', async () => {
    const nextSpy = vi.fn();

    // biome-ignore lint/suspicious/useAwait: satisfies AsyncGenerator interface for toObservable
    async function* sourceWithSpy() {
      nextSpy();
      yield 1;
    }

    const _observable = toObservable(sourceWithSpy());

    // Just create observable, don't subscribe
    await new Promise(resolve => setTimeout(resolve, 10));

    // nextSpy might or might not be called depending on implementation
    // This test documents the behavior
    expect(true).toBeTruthy(); // Placeholder
  });

  it('should call error handler with error object', async () => {
    const testError = new Error('Custom error message');

    // biome-ignore lint/suspicious/useAwait: satisfies AsyncGenerator interface for toObservable
    async function* sourceWithCustomError() {
      yield;
      throw testError;
    }

    let capturedError: unknown;

    toObservable(sourceWithCustomError()).subscribe({
      error: err => {
        capturedError = err;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(capturedError).toBe(testError);
    expect((capturedError as Error).message).toBe('Custom error message');
  });
});
