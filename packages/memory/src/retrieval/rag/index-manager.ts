import { createHash } from 'node:crypto';

import type { IngestSummary, RAGServerDocument } from './types.js';

export interface IndexedDocumentRecord {
  document: RAGServerDocument;
  fingerprint: string;
  version: number;
}

export interface IndexManager {
  upsertMany(documents: RAGServerDocument[]): IngestSummary;
  remove(documentId: string): boolean;
  get(documentId: string): IndexedDocumentRecord | null;
  list(): IndexedDocumentRecord[];
}

function fingerprintOf(document: RAGServerDocument): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: document.title,
        content: document.content,
        metadata: document.metadata,
        updatedAt: document.updatedAt,
        chunkIndex: document.chunkIndex
      })
    )
    .digest('hex');
}

export function createIndexManager(): IndexManager {
  const records = new Map<string, IndexedDocumentRecord>();

  return {
    upsertMany(documents) {
      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const document of documents) {
        const nextFingerprint = fingerprintOf(document);
        const existing = records.get(document.id);
        if (!existing) {
          records.set(document.id, {
            document,
            fingerprint: nextFingerprint,
            version: 1
          });
          inserted += 1;
          continue;
        }

        if (existing.fingerprint === nextFingerprint) {
          skipped += 1;
          continue;
        }

        records.set(document.id, {
          document,
          fingerprint: nextFingerprint,
          version: existing.version + 1
        });
        updated += 1;
      }

      return { inserted, updated, skipped };
    },

    remove(documentId) {
      return records.delete(documentId);
    },

    get(documentId) {
      return records.get(documentId) ?? null;
    },

    list() {
      return [...records.values()].map(record => ({
        document: record.document,
        fingerprint: record.fingerprint,
        version: record.version
      }));
    }
  };
}
