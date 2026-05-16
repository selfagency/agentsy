import { createHash } from 'node:crypto';

import type { IngestOutput, IngestSource, RAGServerDocument } from './types.js';

export interface DocumentIngestor {
  ingest(source: IngestSource): Promise<IngestOutput>;
}

function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}

function splitIntoChunks(content: string, maxChunkSize = 280): string[] {
  const normalized = content.replaceAll(/\s+/gu, ' ').trim();
  if (normalized.length <= maxChunkSize) {
    return normalized.length === 0 ? [] : [normalized];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + maxChunkSize);
    const slice = normalized.slice(cursor, end).trim();
    if (slice.length > 0) {
      chunks.push(slice);
    }
    cursor = end;
  }

  return chunks;
}

export function createDocumentIngestor(): DocumentIngestor {
  return {
    async ingest(source) {
      const chunks = splitIntoChunks(source.content);
      const updatedAt = source.updatedAt ?? new Date().toISOString();

      const documents: RAGServerDocument[] = chunks.map((content, chunkIndex) => {
        const stableId = stableHash(`${source.sourceId}:${chunkIndex}:${content}`);
        return {
          chunkIndex,
          content,
          id: `${source.sourceId}:${stableId}`,
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          title: source.title ?? source.sourceId,
          updatedAt,
          ...(source.metadata === undefined ? {} : { metadata: { ...source.metadata } })
        };
      });

      return { documents };
    }
  };
}
