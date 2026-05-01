import { expect } from 'vitest';

/**
 * Test helper for normalizer finish reason mappings.
 * @internal
 */
export function createFinishReasonTest(
  normalizer: (input: any) => any,
  createInput: (finishReason: string | null) => any,
  testCases: Array<{ input: string | null; expectedFinishReason: string | undefined; expectedDone: boolean }>,
): void {
  for (const { input, expectedFinishReason, expectedDone } of testCases) {
    const result = normalizer(createInput(input as any));
    expect(result?.chunk.finishReason).toBe(expectedFinishReason);
    expect(result?.chunk.done).toBe(expectedDone);
  }
}

/**
 * Test helper for normalizer content mapping.
 * @internal
 */
export function testContentMapping(
  normalizer: (input: any) => any,
  setupInput: (content: string) => any,
  expectedField: 'content' | 'thinking',
  expectedValue: string,
): void {
  const result = normalizer(setupInput(expectedValue));
  expect(result?.chunk[expectedField]).toBe(expectedValue);
  expect(result?.chunk.done).toBeFalsy();
}

/**
 * Test helper for asserting non-terminal chunks don't set finishReason.
 * @internal
 */
export function testMidStreamNoFinishReason(normalizer: (input: any) => any, setupInput: () => any): void {
  const result = normalizer(setupInput());
  expect(result?.chunk.finishReason).toBeUndefined();
  expect(result?.chunk.done).not.toBe(true);
}
