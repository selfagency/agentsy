/**
 * Source allowlist + provenance tracking.
 *
 * Verifies ingestion sources against an allowlist and tags every chunk
 * with provenance metadata. Unverified sources can be redacted from output.
 */

export interface ProvenanceTag {
  sourceId: string;
  sourceType: 'local' | 'web' | 'memory';
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
  sourceType: 'local' | 'web' | 'memory';
}

export interface ProvenanceIngestResult {
  chunkIds: string[];
  provenance: Map<string, ProvenanceTag[]>;
}

/**
 * Check if a source matches any allowlist pattern.
 * Patterns support glob-style wildcards: `*` matches any sequence.
 */
export function matchesPattern(source: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }
  if (pattern.endsWith('*')) {
    return source.startsWith(pattern.slice(0, -1));
  }
  if (pattern.startsWith('*')) {
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
): { allowed: boolean; sourceType: 'local' | 'web' | 'memory' } {
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
