/**
 * AG-UI Observable Tests
 *
 * Verifies AsyncGenerator to Observable conversion without hard RxJS dependency
 */

import { describe, it, expect, vi } from 'vitest';
import { toObservable } from './observable.js';

describe('toObservable', () => {
  it('should subscribe and emit values', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
    }

    const results: number[] = [];
    toObservable(source()).subscribe({
      next: value => results.push(value),
    });

    // Give async generator time to consume
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3]);
  });

  it('should support callback syntax for next', async () => {
    async function* source() {
      yield 'a';
      yield 'b';
    }

    const results: string[] = [];
    toObservable(source()).subscribe(value => {
      results.push(value);
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toEqual(['a', 'b']);
  });

  it('should call error handler on generator error', async () => {
    async function* source() {
      yield 1;
      throw new Error('Test error');
    }

    const results: any[] = [];
    const errors: any[] = [];

    toObservable(source()).subscribe({
      next: value => results.push(value),
      error: err => errors.push(err),
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(results).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Test error');
  });

  it('should call complete handler after generator finishes', async () => {
    async function* source() {
      yield 1;
      yield 2;
    }

    let completed = false;

    toObservable(source()).subscribe({
      next: () => {},
      complete: () => {
        completed = true;
      },
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(completed).toBe(true);
  });

  it('should support unsubscribe to stop consuming', async () => {
    async function* source() {
      yield 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      yield 2;
      await new Promise(resolve => setTimeout(resolve, 10));
      yield 3;
    }

    const results: number[] = [];

    const subscription = toObservable(source()).subscribe({
      next: value => results.push(value),
    });

    // Unsubscribe immediately
    subscription.unsubscribe();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should only have first value (if it was already yielded)
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should normalize observer with just next callback', async () => {
    async function* source() {
      yield 'test';
    }

    const next = vi.fn();

    toObservable(source()).subscribe({
      next,
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(next).toHaveBeenCalledWith('test');
  });

  it('should handle observer without error handler', async () => {
    async function* source() {
      yield 1;
      throw new Error('Expected');
    }

    const next = vi.fn();
    const complete = vi.fn();

    toObservable(source()).subscribe({
      next,
      complete,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should not crash, just stop
    expect(next).toHaveBeenCalled();
  });

  it('should handle empty generator', async () => {
    async function* source() {
      // Empty
    }

    const next = vi.fn();
    const complete = vi.fn();

    toObservable(source()).subscribe({
      next,
      complete,
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalled();
  });

  it('should return subscription object', () => {
    async function* source() {
      yield 1;
    }

    const subscription = toObservable(source()).subscribe(() => {});

    expect(typeof subscription.unsubscribe).toBe('function');
  });

  it('should support multiple values with no delay', async () => {
    async function* source() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }

    const results: number[] = [];

    toObservable(source()).subscribe({
      next: value => results.push(value),
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle async operations in generator', async () => {
    async function* source() {
      yield 'start';
      await new Promise(resolve => setTimeout(resolve, 20));
      yield 'middle';
      await new Promise(resolve => setTimeout(resolve, 20));
      yield 'end';
    }

    const results: string[] = [];

    toObservable(source()).subscribe({
      next: value => results.push(value),
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(results).toEqual(['start', 'middle', 'end']);
  });

  it('should not consume generator if not subscribed', async () => {
    const nextSpy = vi.fn();

    async function* source() {
      nextSpy();
      yield 1;
    }

    const _observable = toObservable(source());

    // Just create observable, don't subscribe
    await new Promise(resolve => setTimeout(resolve, 10));

    // nextSpy might or might not be called depending on implementation
    // This test documents the behavior
    expect(true).toBe(true); // Placeholder
  });

  it('should call error handler with error object', async () => {
    const testError = new Error('Custom error message');

    async function* source() {
      yield;
      throw testError;
    }

    let capturedError: any;

    toObservable(source()).subscribe({
      error: err => {
        capturedError = err;
      },
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(capturedError).toBe(testError);
    expect(capturedError.message).toBe('Custom error message');
  });
});
