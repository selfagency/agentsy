import { describe, expect, it } from 'vitest';
import { fingerprintContent, fingerprintsEqual } from './fingerprint.js';

describe('fingerprintContent', () => {
  it('returns blake3 algorithm', () => {
    const fp = fingerprintContent('hello');
    expect(fp.algorithm).toBe('blake3');
  });

  it('value is prefixed with blake3:', () => {
    const fp = fingerprintContent('hello');
    expect(fp.value).toMatch(/^blake3:[a-f0-9]{64}$/);
  });

  it('size equals byte length of string content', () => {
    const input = 'hello';
    const fp = fingerprintContent(input);
    expect(fp.size).toBe(new TextEncoder().encode(input).byteLength);
  });

  it('size equals byte length of Uint8Array content', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fp = fingerprintContent(bytes);
    expect(fp.size).toBe(4);
  });

  it('same string produces same fingerprint (determinism)', () => {
    const a = fingerprintContent('deterministic');
    const b = fingerprintContent('deterministic');
    expect(a.value).toBe(b.value);
  });

  it('different content produces different fingerprint', () => {
    const a = fingerprintContent('aaa');
    const b = fingerprintContent('bbb');
    expect(a.value).not.toBe(b.value);
  });

  it('empty string has a valid fingerprint', () => {
    const fp = fingerprintContent('');
    expect(fp.value).toMatch(/^blake3:[a-f0-9]{64}$/);
    expect(fp.size).toBe(0);
  });
});

describe('fingerprintsEqual', () => {
  it('returns true for same content', () => {
    const a = fingerprintContent('equal');
    const b = fingerprintContent('equal');
    expect(fingerprintsEqual(a, b)).toBe(true);
  });

  it('returns false for different content', () => {
    const a = fingerprintContent('one');
    const b = fingerprintContent('two');
    expect(fingerprintsEqual(a, b)).toBe(false);
  });
});
