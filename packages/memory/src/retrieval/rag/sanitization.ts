import type { IngestSource } from './types.js';

const SECRET_PATTERN = /(sk-[a-z0-9]{20,}|sk_[a-z0-9_-]{8,}|api[_-]?key\s*[=:]\s*\S+|bearer\s+[a-z0-9._-]{10,})/giu;

export function sanitizeIngestSource(source: IngestSource): IngestSource {
  return {
    ...source,
    content: source.content.replace(SECRET_PATTERN, '[REDACTED]'),
    ...(source.metadata === undefined ? {} : { metadata: { ...source.metadata } })
  };
}
