import { createHash } from 'node:crypto';

export interface ContentFingerprint {
  readonly algorithm: 'sha256';
  readonly value: string;
  readonly size: number;
}

export function fingerprintContent(content: string | Uint8Array): ContentFingerprint {
  const hash = createHash('sha256');
  if (typeof content === 'string') {
    hash.update(content, 'utf8');
  } else {
    hash.update(content);
  }
  const value = 'sha256:' + hash.digest('hex');
  const size = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.byteLength;
  return { algorithm: 'sha256', value, size };
}

export function fingerprintsEqual(a: ContentFingerprint, b: ContentFingerprint): boolean {
  return a.value === b.value;
}
