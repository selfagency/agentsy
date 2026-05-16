import { hash as blake3 } from 'blake3-jit';

export interface ContentFingerprint {
  readonly algorithm: 'blake3';
  readonly value: string;
  readonly size: number;
}

export function fingerprintContent(content: string | Uint8Array): ContentFingerprint {
  const enc = new TextEncoder();
  const bytes = typeof content === 'string' ? enc.encode(content) : content;
  const digest = blake3(bytes);
  const value = `blake3:${Buffer.from(digest).toString('hex')}`;
  const size = bytes.byteLength;
  return { algorithm: 'blake3', value, size };
}

export function fingerprintsEqual(a: ContentFingerprint, b: ContentFingerprint): boolean {
  return a.value === b.value;
}
