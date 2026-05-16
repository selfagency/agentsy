import type { ContentFingerprint } from './fingerprint.js';
import { fingerprintContent } from './fingerprint.js';

export interface VerifyResult {
  readonly ok: boolean;
  readonly expected: string;
  readonly actual: string;
}

export function verifyContent(content: string | Uint8Array, expected: ContentFingerprint | string): VerifyResult {
  const actual = fingerprintContent(content);
  const expectedValue = typeof expected === 'string' ? expected : expected.value;
  return {
    ok: actual.value === expectedValue,
    expected: expectedValue,
    actual: actual.value
  };
}

export function assertContent(content: string | Uint8Array, expected: ContentFingerprint | string): void {
  const result = verifyContent(content, expected);
  if (!result.ok) {
    throw new Error(`Content integrity check failed: expected ${result.expected}, got ${result.actual}`);
  }
}
