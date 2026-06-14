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

  it('matches wildcard suffix with path boundary', () => {
    expect(matchesPattern('/home/docs/file.md', '/home/docs/*')).toBe(true);
    expect(matchesPattern('/home/docs/', '/home/docs/*')).toBe(true);
    expect(matchesPattern('/home/other/file.md', '/home/docs/*')).toBe(false);
  });

  it('prevents path traversal with wildcard suffix', () => {
    // /home/docs/* should NOT match /home/docs-elsewhere/
    expect(matchesPattern('/home/docs-elsewhere/file.md', '/home/docs/*')).toBe(false);
    expect(matchesPattern('/home/docs_backup/file.md', '/home/docs/*')).toBe(false);
  });

  it('matches global wildcard', () => {
    expect(matchesPattern('anything', '*')).toBe(true);
  });

  it('matches domain wildcard with dot boundary', () => {
    expect(matchesPattern('sub.docs.example.com', '*.docs.example.com')).toBe(true);
    expect(matchesPattern('docs.example.com', '*.docs.example.com')).toBe(false); // need subdomain dot
  });

  it('prevents domain bypass with wildcard prefix', () => {
    // *.docs.example.com should NOT match evil.docs.example.com.evildomain.com
    expect(matchesPattern('evil.docs.example.com.evildomain.com', '*.docs.example.com')).toBe(false);
    expect(matchesPattern('notdocs.example.com', '*.docs.example.com')).toBe(false);
  });

  it('matches generic suffix wildcard', () => {
    expect(matchesPattern('foobar', 'foo*')).toBe(true);
    expect(matchesPattern('barfoo', 'foo*')).toBe(false);
  });

  it('matches generic prefix wildcard', () => {
    expect(matchesPattern('bar.md', '*.md')).toBe(true);
    expect(matchesPattern('bar.txt', '*.md')).toBe(false);
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

  it('denies path traversal attempt', () => {
    const result = verifySource('/home/docs-elsewhere/evil.sh', allowlist);
    expect(result.allowed).toBe(false);
  });

  it('denies domain bypass attempt', () => {
    const result = verifySource('evil.docs.example.com.evildomain.com', allowlist);
    expect(result.allowed).toBe(false);
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
