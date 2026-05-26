import { expect } from 'vitest';

export interface MockCancellationToken {
  cancel(): void;
  isCancellationRequested: boolean;
  onCancellationRequested(listener: (e: unknown) => unknown): { dispose(): void };
}

/**
 * Creates a mock CancellationToken that can be used in tests.
 *
 * @param initiallyCancelled - whether the token starts as cancelled
 * @returns A mock CancellationToken with cancel() and isCancellationRequested/onCancellationRequested properties
 */
export function createMockCancellationToken(initiallyCancelled = false): MockCancellationToken {
  const listeners = new Set<(e: unknown) => void>();
  let cancelled = initiallyCancelled;

  return {
    cancel() {
      cancelled = true;
      for (const listener of listeners) {
        listener(undefined);
      }
    },
    isCancellationRequested: cancelled,
    onCancellationRequested(listener: (e: unknown) => unknown) {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        }
      };
    }
  };
}

/**
 * Expects the given stream to have all the expected UI anchor types.
 *
 * @param stream - The stream to check
 */
export function expectStreamToHaveAllAnchors(stream: Record<string, unknown>) {
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toBeDefined();
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('markdown');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('anchor');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('button');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('filetree');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('progress');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('reference');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('push');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('image');
  // biome-ignore lint/suspicious/noMisplacedAssertion: Test helper used inside it() blocks
  expect(stream).toHaveProperty('audio');
}
