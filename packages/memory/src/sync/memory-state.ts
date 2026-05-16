import type { RawCapture, VectorEntry, WikiPage } from '../wiki/wiki-manager.js';
import { computeSyncChecksum, verifySyncChecksum } from './integrity.js';
import type { MemorySyncTier, SyncRecord, SyncSnapshot } from './types.js';

export interface MemoryState {
  rawCaptures: RawCapture[];
  pages: WikiPage[];
  vectors: VectorEntry[];
}

export interface MemoryStateAdapter {
  getCurrentState(): Promise<SyncSnapshot>;
  applySnapshot(snapshot: SyncSnapshot): Promise<void>;
}

export interface MemoryStateAdapterOptions {
  getState(): MemoryState | Promise<MemoryState>;
  applyState(state: MemoryState): Promise<void> | void;
  getCursor?: () => string | Promise<string>;
}

function cloneRawCapture(capture: RawCapture): RawCapture {
  return {
    ...capture,
    createdAt: new Date(capture.createdAt)
  };
}

function cloneWikiPage(page: WikiPage): WikiPage {
  return {
    ...page,
    tags: [...page.tags],
    updatedAt: new Date(page.updatedAt),
    writerIds: [...page.writerIds]
  };
}

function cloneVector(vector: VectorEntry): VectorEntry {
  return {
    ...vector,
    embedding: [...vector.embedding]
  };
}

function serializeRawCapture(capture: RawCapture): SyncRecord {
  return {
    content: capture.content,
    id: capture.id,
    metadata: {
      normalizedContent: capture.normalizedContent,
      sourceId: capture.sourceId,
      sourceType: capture.sourceType
    },
    tier: 'raw',
    updatedAt: capture.createdAt.toISOString()
  };
}

function serializeWikiPage(page: WikiPage): SyncRecord {
  return {
    content: page.body,
    id: page.pageId,
    metadata: {
      format: page.format,
      tags: [...page.tags],
      title: page.title,
      version: page.version,
      writerIds: [...page.writerIds]
    },
    tier: 'wiki',
    updatedAt: page.updatedAt.toISOString()
  };
}

function serializeVectorEntry(vector: VectorEntry, updatedAt: string): SyncRecord {
  return {
    content: JSON.stringify(vector.embedding),
    id: vector.pageId,
    metadata: {
      dimensions: vector.embedding.length
    },
    tier: 'vector',
    updatedAt,
    vectorFingerprint: computeSyncChecksum(vector.embedding)
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}

function readMetadata(record: SyncRecord): Record<string, unknown> {
  return record.metadata ?? {};
}

function deserializeRawCapture(record: SyncRecord): RawCapture {
  const metadata = readMetadata(record);

  return {
    content: record.content,
    createdAt: new Date(record.updatedAt),
    id: record.id,
    normalizedContent: typeof metadata.normalizedContent === 'string' ? metadata.normalizedContent : record.content,
    sourceId: typeof metadata.sourceId === 'string' ? metadata.sourceId : record.id,
    sourceType:
      metadata.sourceType === 'document' || metadata.sourceType === 'conversation' || metadata.sourceType === 'capture'
        ? metadata.sourceType
        : 'capture'
  };
}

function deserializeWikiPage(record: SyncRecord): WikiPage {
  const metadata = readMetadata(record);

  return {
    body: record.content,
    format:
      metadata.format === 'markdown' ||
      metadata.format === 'text' ||
      metadata.format === 'code' ||
      metadata.format === 'json'
        ? metadata.format
        : 'markdown',
    pageId: record.id,
    tags: isStringArray(metadata.tags) ? [...metadata.tags] : [],
    title: typeof metadata.title === 'string' ? metadata.title : record.id,
    updatedAt: new Date(record.updatedAt),
    version: typeof metadata.version === 'number' ? metadata.version : 1,
    writerIds: isStringArray(metadata.writerIds) ? [...metadata.writerIds] : []
  };
}

function deserializeVectorEntry(record: SyncRecord): VectorEntry {
  const parsed = JSON.parse(record.content) as unknown;
  const embedding = isNumberArray(parsed) ? parsed : [];

  if (record.vectorFingerprint && !verifySyncChecksum(embedding, record.vectorFingerprint)) {
    throw new Error(`Vector fingerprint mismatch for ${record.id}`);
  }

  return {
    embedding,
    pageId: record.id
  };
}

function tierRank(tier: MemorySyncTier): number {
  if (tier === 'raw') {
    return 0;
  }

  if (tier === 'wiki') {
    return 1;
  }

  return 2;
}

function sortRecords(records: SyncRecord[]): SyncRecord[] {
  return [...records].toSorted((left, right) => {
    const tierDifference = tierRank(left.tier) - tierRank(right.tier);
    if (tierDifference !== 0) {
      return tierDifference;
    }

    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt.localeCompare(right.updatedAt);
    }

    return left.id.localeCompare(right.id);
  });
}

function cloneMemoryState(state: MemoryState): MemoryState {
  return {
    pages: state.pages.map(cloneWikiPage),
    rawCaptures: state.rawCaptures.map(cloneRawCapture),
    vectors: state.vectors.map(cloneVector)
  };
}

export function serializeMemoryState(state: MemoryState, cursor = ''): SyncSnapshot {
  const updatedAtByPageId = new Map(state.pages.map(page => [page.pageId, page.updatedAt.toISOString()]));
  const records = sortRecords([
    ...state.rawCaptures.map(serializeRawCapture),
    ...state.pages.map(serializeWikiPage),
    ...state.vectors.map(vector =>
      serializeVectorEntry(vector, updatedAtByPageId.get(vector.pageId) ?? '1970-01-01T00:00:00.000Z')
    )
  ]);

  return {
    cursor,
    records
  };
}

export function deserializeMemoryState(snapshot: SyncSnapshot): MemoryState {
  const rawCaptures: RawCapture[] = [];
  const pages: WikiPage[] = [];
  const vectors: VectorEntry[] = [];

  for (const record of snapshot.records) {
    if (record.tier === 'raw') {
      rawCaptures.push(deserializeRawCapture(record));
      continue;
    }

    if (record.tier === 'wiki') {
      pages.push(deserializeWikiPage(record));
      continue;
    }

    vectors.push(deserializeVectorEntry(record));
  }

  return {
    pages,
    rawCaptures,
    vectors
  };
}

export function createMemoryStateAdapter(options: MemoryStateAdapterOptions): MemoryStateAdapter {
  return {
    async applySnapshot(snapshot: SyncSnapshot) {
      await options.applyState(deserializeMemoryState(snapshot));
    },

    async getCurrentState() {
      const state = cloneMemoryState(await options.getState());
      const cursor = await options.getCursor?.();

      return serializeMemoryState(state, cursor ?? '');
    }
  };
}
