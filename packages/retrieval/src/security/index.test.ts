import { describe, expect, it } from 'vitest';
import {
  ingestWithProvenance,
  matchesPattern,
  redactUnverifiedSources,
  SourceNotAllowedError,
  verifySource
} from './index.js';

describe('matchesPattern', () => {
  it('matches exact pattern', () => {
    expect(matchesPattern('/home/docs/file.md', '/home/docs/file.md')).toBe(true);
    expect(matchesPattern('/home/docs/file.md', '/home/docs/other.md')).toBe(false);
  });

  it('matches wildcard suffix', () => {
    expect(matchesPattern('/home/docs/file.md', '/home/docs/*')).toBe(true);
    expect(matchesPattern('/home/other/file.md', '/home/docs/*')).toBe(false);
  });

  it('matches global wildcard', () => {
    expect(matchesPattern('anything', '*')).toBe(true);
  });

  it('matches wildcard prefix', () => {
    expect(matchesPattern('file.md', '*.md')).toBe(true);
    expect(matchesPattern('file.txt', '*.md')).toBe(false);
  });
});

describe('verifySource', () => {
  const allowlist = [
    { pattern: '/home/docs/*', sourceType: 'local' as const },
    { pattern: '*.docs.example.com', sourceType: 'web' as const }
  ];

  it('allows matching source', () => {
    const result = verifySource('/home/docs/file.md', allowlist);
    expect(result.allowed).toBe(true);
    expect(result.sourceType).toBe('local');
  });

  it('denies non-matching source', () => {
    const result = verifySource('/etc/passwd', allowlist);
    expect(result.allowed).toBe(false);
  });
});

describe('ingestWithProvenance', () => {
  it('tags chunks with provenance', () => {
    const result = ingestWithProvenance(['a', 'b'], '/home/docs/file.md', [
      { pattern: '/home/docs/*', sourceType: 'local' }
    ]);
    expect(result.chunkIds).toEqual(['a', 'b']);
    expect(result.provenance.get('a')?.length).toBe(1);
    expect(result.provenance.get('a')?.[0]?.verified).toBe(true);
    expect(result.provenance.get('a')?.[0]?.sourceType).toBe('local');
  });

  it('throws for unallowed source', () => {
    expect(() =>
      ingestWithProvenance(['a'], '/etc/passwd', [{ pattern: '/home/docs/*', sourceType: 'local' }])
    ).toThrow(SourceNotAllowedError);
  });
});

describe('redactUnverifiedSources', () => {
  it('leaves verified chunks alone', () => {
    const provenance = new Map();
    provenance.set('a', [{ sourceId: 'doc', sourceType: 'local', timestamp: new Date(), verified: true }]);
    const result = redactUnverifiedSources('See [a] for details', provenance);
    expect(result).toBe('See [a] for details');
  });

  it('redacts unverified chunks', () => {
    const result = redactUnverifiedSources('See [a] for details', new Map());
    expect(result).toBe('See [REDACTED:UNVERIFIED] for details');
  });
});
