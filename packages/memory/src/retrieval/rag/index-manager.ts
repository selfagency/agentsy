import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { MemoryDatabase } from '../../database/connection.js';
import { ragDocuments } from '../../database/schema.js';
import type { IngestSummary, RAGServerDocument } from './types.js';

export interface IndexedDocumentRecord {
  document: RAGServerDocument;
  fingerprint: string;
  version: number;
}

export interface IndexManager {
  get(documentId: string): IndexedDocumentRecord | null;
  list(): IndexedDocumentRecord[];
  remove(documentId: string): boolean;
  upsertMany(documents: RAGServerDocument[]): IngestSummary;
}

export interface IndexManagerOptions {
  db?: MemoryDatabase | undefined;
}

function fingerprintOf(document: RAGServerDocument): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        chunkIndex: document.chunkIndex,
        content: document.content,
        metadata: document.metadata,
        title: document.title,
        updatedAt: document.updatedAt
      })
    )
    .digest('hex');
}

function documentToRow(document: RAGServerDocument, fingerprint: string, version: number) {
  return {
    id: document.id,
    sourceId: document.sourceId,
    sourceType: document.sourceType,
    title: document.title,
    content: document.content,
    chunkIndex: document.chunkIndex,
    updatedAt: Date.parse(document.updatedAt),
    metadata: JSON.stringify(document.metadata ?? {}),
    fingerprint,
    version
  };
}

function rowToDocument(row: { [key: string]: unknown }): RAGServerDocument {
  const metadataValue = row.metadata;
  const hasMetadata =
    metadataValue !== undefined && typeof metadataValue === 'string' && metadataValue !== '{}' && metadataValue !== '';

  return {
    id: String(row.id),
    sourceId: String(row.sourceId),
    sourceType: String(row.sourceType) as RAGServerDocument['sourceType'],
    title: String(row.title),
    content: String(row.content),
    chunkIndex: Number(row.chunkIndex),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
    ...(hasMetadata ? { metadata: JSON.parse(metadataValue) as Record<string, unknown> } : {})
  };
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

function createInMemoryIndexManager(): IndexManager {
  const records = new Map<string, IndexedDocumentRecord>();

  return {
    get(documentId) {
      return records.get(documentId) ?? null;
    },

    list() {
      return [...records.values()].map(record => ({
        document: record.document,
        fingerprint: record.fingerprint,
        version: record.version
      }));
    },

    remove(documentId) {
      return records.delete(documentId);
    },

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

      return { inserted, skipped, updated };
    }
  };
}

// ---------------------------------------------------------------------------
// SQLite-backed implementation
// ---------------------------------------------------------------------------

function createSQLiteIndexManager(db: MemoryDatabase): IndexManager {
  return {
    get(documentId) {
      const row = db.select().from(ragDocuments).where(eq(ragDocuments.id, documentId)).get();
      if (!row) {
        return null;
      }

      return {
        document: rowToDocument(row),
        fingerprint: String(row.fingerprint),
        version: Number(row.version)
      };
    },

    list() {
      const rows = db.select().from(ragDocuments).all();
      return rows.map(row => ({
        document: rowToDocument(row),
        fingerprint: String(row.fingerprint),
        version: Number(row.version)
      }));
    },

    remove(documentId) {
      const existing = db.select().from(ragDocuments).where(eq(ragDocuments.id, documentId)).get();
      if (!existing) {
        return false;
      }

      db.delete(ragDocuments).where(eq(ragDocuments.id, documentId)).run();
      return true;
    },

    upsertMany(documents) {
      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const document of documents) {
        const nextFingerprint = fingerprintOf(document);
        const existing = db.select().from(ragDocuments).where(eq(ragDocuments.id, document.id)).get();

        if (!existing) {
          db.insert(ragDocuments)
            .values(documentToRow(document, nextFingerprint, 1))
            .run();
          inserted += 1;
          continue;
        }

        if (String(existing.fingerprint) === nextFingerprint) {
          skipped += 1;
          continue;
        }

        const nextVersion = Number(existing.version) + 1;
        db.update(ragDocuments)
          .set(documentToRow(document, nextFingerprint, nextVersion))
          .where(eq(ragDocuments.id, document.id))
          .run();
        updated += 1;
      }

      return { inserted, skipped, updated };
    }
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIndexManager(options: IndexManagerOptions = {}): IndexManager {
  if (options.db) {
    return createSQLiteIndexManager(options.db);
  }
  return createInMemoryIndexManager();
}
