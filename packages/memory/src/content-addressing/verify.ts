import type { ContentFingerprint } from './fingerprint.js';
import { fingerprintContent } from './fingerprint.js';

export interface VerifyResult {
  readonly actual: string;
  readonly expected: string;
  readonly ok: boolean;
}

export function verifyContent(content: string | Uint8Array, expected: ContentFingerprint | string): VerifyResult {
  const actual = fingerprintContent(content);
  const expectedValue = typeof expected === 'string' ? expected : expected.value;
  return {
    actual: actual.value,
    expected: expectedValue,
    ok: actual.value === expectedValue
  };
}

export function assertContent(content: string | Uint8Array, expected: ContentFingerprint | string): void {
  const result = verifyContent(content, expected);
  if (!result.ok) {
    throw new Error(`Content integrity check failed: expected ${result.expected}, got ${result.actual}`);
  }
}
