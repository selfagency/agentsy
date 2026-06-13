/**
 * Source allowlist + provenance tracking.
 *
 * Verifies ingestion sources against an allowlist and tags every chunk
 * with provenance metadata. Unverified sources can be redacted from output.
 */

export type SourceType = 'local' | 'web' | 'memory';

export interface ProvenanceTag {
  sourceId: string;
  sourceType: SourceType;
  timestamp: Date;
  verified: boolean;
}

export class SourceNotAllowedError extends Error {
  constructor(source: string) {
    super(`Source not allowed: ${source}`);
    this.name = 'SourceNotAllowedError';
  }
}

export interface AllowlistEntry {
  pattern: string;
  sourceType: SourceType;
}

export interface ProvenanceIngestResult {
  chunkIds: string[];
  provenance: Map<string, ProvenanceTag[]>;
}

/**
 * Check if a source matches any allowlist pattern.
 *
 * Patterns support glob-style wildcards:
 * - `/path/to/*` — directory wildcard: matches `/path/to/` prefix only (path-boundary safe)
 * - `*.example.com` — domain wildcard: matches `.example.com` suffix only (dot-boundary safe)
 * - `*` — matches everything
 *
 * Path-boundary enforcement: `/home/docs/*` does NOT match `/home/docs-elsewhere/file`.
 * Domain-boundary enforcement: `*.example.com` does NOT match `evil.example.com.evildomain.com`.
 */
export function matchesPattern(source: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }
  // Directory wildcard: /path/to/* → match /path/to/ prefix (with path boundary)
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -1); // "/path/to/"
    return source === base.slice(0, -1) || source.startsWith(base);
  }
  // Generic suffix wildcard: foo* → match "foo" prefix
  if (pattern.endsWith('*') && !pattern.endsWith('/*')) {
    return source.startsWith(pattern.slice(0, -1));
  }
  // Domain wildcard: *.docs.example.com → match "docs.example.com" or ".docs.example.com" suffix
  // Generic suffix: *.md → match ".md" suffix
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".docs.example.com" or ".md" (includes leading dot)
    // Domain patterns have internal dots — enforce subdomain boundary
    if (suffix.slice(1).includes('.')) {
      return source.endsWith(suffix);
    }
    // Generic extension suffix
    return source.endsWith(suffix);
  }
  // Generic prefix wildcard: *foo → match "foo" suffix
  if (pattern.startsWith('*') && !pattern.startsWith('*.')) {
    return source.endsWith(pattern.slice(1));
  }
  return source === pattern;
}

/**
 * Verify a source against the allowlist. Throws if not allowed.
 */
export function verifySource(
  source: string,
  allowlist: AllowlistEntry[]
): { allowed: boolean; sourceType: SourceType } {
  for (const entry of allowlist) {
    if (matchesPattern(source, entry.pattern)) {
      return { allowed: true, sourceType: entry.sourceType };
    }
  }
  return { allowed: false, sourceType: 'web' };
}

export function ingestWithProvenance(
  chunkIds: string[],
  source: string,
  allowlist: AllowlistEntry[]
): ProvenanceIngestResult {
  const verification = verifySource(source, allowlist);
  if (!verification.allowed) {
    throw new SourceNotAllowedError(source);
  }

  const tag: ProvenanceTag = {
    sourceId: source,
    sourceType: verification.sourceType,
    timestamp: new Date(),
    verified: true
  };

  const provenance = new Map<string, ProvenanceTag[]>();
  for (const id of chunkIds) {
    provenance.set(id, [tag]);
  }

  return { chunkIds, provenance };
}

/**
 * Redact unverified sources from a context string.
 * Replaces [chunkId] references with [REDACTED] for unverified chunks.
 */
export function redactUnverifiedSources(context: string, provenance: Map<string, ProvenanceTag[]>): string {
  return context.replace(/\[(\w+)\]/g, (_match, chunkId: string) => {
    const tags = provenance.get(chunkId);
    if (tags?.some(t => t.verified)) {
      return _match;
    }
    return '[REDACTED:UNVERIFIED]';
  });
}
