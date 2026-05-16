// fallow-ignore-file unused-file

import { expect } from "vitest";

import type { NormalizerResult } from "./types.js";

/**
 * Test helper for normalizer finish reason mappings.
 * @internal
 */
export function createFinishReasonTest(
  normalizer: (input: Record<string, unknown>) => NormalizerResult | undefined,
  createInput: (finishReason: string | null) => Record<string, unknown>,
  testCases: {
    input: string | null;
    expectedFinishReason: string | undefined;
    expectedDone: boolean;
  }[]
): void {
  for (const { input, expectedFinishReason, expectedDone } of testCases) {
    const result = normalizer(createInput(input));
    expect(result?.chunk.finishReason).toBe(expectedFinishReason);
    expect(result?.chunk.done).toBe(expectedDone);
  }
}

/**
 * Test helper for normalizer content mapping.
 * @internal
 */
export function testContentMapping(
  normalizer: (input: Record<string, unknown>) => NormalizerResult | undefined,
  setupInput: (content: string) => Record<string, unknown>,
  expectedField: "content" | "thinking",
  expectedValue: string
): void {
  const result = normalizer(setupInput(expectedValue));
  expect(result?.chunk[expectedField as keyof typeof result.chunk]).toBe(
    expectedValue
  );
  expect(result?.chunk.done).toBeFalsy();
}

/**
 * Test helper for asserting non-terminal chunks don't set finishReason.
 * @internal
 */
export function testMidStreamNoFinishReason(
  normalizer: (input: Record<string, unknown>) => NormalizerResult | undefined,
  setupInput: () => Record<string, unknown>
): void {
  const result = normalizer(setupInput());
  expect(result?.chunk.finishReason).toBeUndefined();
  expect(result?.chunk.done).not.toBe(true);
}
