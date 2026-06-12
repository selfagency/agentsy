// biome-ignore-all lint/suspicious/noMisplacedAssertion: test helpers intentionally contain assertions

import { expect } from 'vitest';
import type { Detection, GuardrailResult } from './types.js';

export async function assertPass(
  scanner: { evaluate(input: string): Promise<GuardrailResult> },
  input: string
): Promise<void> {
  const result = await scanner.evaluate(input);
  expect(result.status, `Expected pass for: ${input}`).toBe('pass');
}

export async function assertBlock(
  scanner: { evaluate(input: string): Promise<GuardrailResult> },
  input: string,
  reasonPrefix?: string
): Promise<GuardrailResult> {
  const result = await scanner.evaluate(input);
  expect(result.status, `Expected block for: ${input}`).toBe('block');
  if (reasonPrefix && result.status === 'block') {
    expect(result.reason).toContain(reasonPrefix);
  }
  return result;
}

export function assertDetections(result: GuardrailResult, expectedIds: string[]): void {
  const dr = result as unknown as { detections?: Detection[] };
  expect(dr.detections).toBeDefined();
  const ids = dr.detections?.map(d => d.id) ?? [];
  for (const id of expectedIds) {
    expect(ids).toContain(id);
  }
}

export function assertResult(
  result: GuardrailResult,
  expected: Partial<GuardrailResult> & { status: GuardrailResult['status'] }
): void {
  if (expected.status === 'block' && result.status === 'block') {
    expect(result.status).toBe('block');
    if ('reason' in expected && expected.reason) {
      expect(result.reason).toContain(expected.reason);
    }
  } else if (expected.status === 'transform' && result.status === 'transform') {
    expect(result.status).toBe('transform');
    if ('sanitized' in expected) {
      expect(result.sanitized).toBe((expected as { sanitized?: string }).sanitized);
    }
  } else if (expected.status === 'escalate' && result.status === 'escalate') {
    expect(result.status).toBe('escalate');
  } else if (expected.status === 'pass') {
    expect(result.status).toBe('pass');
  }
}
