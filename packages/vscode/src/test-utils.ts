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
export function expectStreamToHaveAllAnchors(stream: any) {
  expect(stream).toBeDefined();
  expect(stream).toHaveProperty('markdown');
  expect(stream).toHaveProperty('anchor');
  expect(stream).toHaveProperty('button');
  expect(stream).toHaveProperty('filetree');
  expect(stream).toHaveProperty('progress');
  expect(stream).toHaveProperty('reference');
  expect(stream).toHaveProperty('push');
  expect(stream).toHaveProperty('image');
  expect(stream).toHaveProperty('audio');
}
