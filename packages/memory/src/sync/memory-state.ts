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
    writerIds: [...page.writerIds],
    updatedAt: new Date(page.updatedAt)
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
    id: capture.id,
    tier: 'raw',
    updatedAt: capture.createdAt.toISOString(),
    content: capture.content,
    metadata: {
      sourceId: capture.sourceId,
      sourceType: capture.sourceType,
      normalizedContent: capture.normalizedContent
    }
  };
}

function serializeWikiPage(page: WikiPage): SyncRecord {
  return {
    id: page.pageId,
    tier: 'wiki',
    updatedAt: page.updatedAt.toISOString(),
    content: page.body,
    metadata: {
      title: page.title,
      tags: [...page.tags],
      version: page.version,
      format: page.format,
      writerIds: [...page.writerIds]
    }
  };
}

function serializeVectorEntry(vector: VectorEntry, updatedAt: string): SyncRecord {
  return {
    id: vector.pageId,
    tier: 'vector',
    updatedAt,
    content: JSON.stringify(vector.embedding),
    metadata: {
      dimensions: vector.embedding.length
    },
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
    id: record.id,
    sourceId: typeof metadata.sourceId === 'string' ? metadata.sourceId : record.id,
    sourceType:
      metadata.sourceType === 'document' || metadata.sourceType === 'conversation' || metadata.sourceType === 'capture'
        ? metadata.sourceType
        : 'capture',
    content: record.content,
    normalizedContent: typeof metadata.normalizedContent === 'string' ? metadata.normalizedContent : record.content,
    createdAt: new Date(record.updatedAt)
  };
}

function deserializeWikiPage(record: SyncRecord): WikiPage {
  const metadata = readMetadata(record);

  return {
    pageId: record.id,
    title: typeof metadata.title === 'string' ? metadata.title : record.id,
    body: record.content,
    tags: isStringArray(metadata.tags) ? [...metadata.tags] : [],
    version: typeof metadata.version === 'number' ? metadata.version : 1,
    format:
      metadata.format === 'markdown' ||
      metadata.format === 'text' ||
      metadata.format === 'code' ||
      metadata.format === 'json'
        ? metadata.format
        : 'markdown',
    writerIds: isStringArray(metadata.writerIds) ? [...metadata.writerIds] : [],
    updatedAt: new Date(record.updatedAt)
  };
}

function deserializeVectorEntry(record: SyncRecord): VectorEntry {
  const parsed = JSON.parse(record.content) as unknown;
  const embedding = isNumberArray(parsed) ? parsed : [];

  if (record.vectorFingerprint && !verifySyncChecksum(embedding, record.vectorFingerprint)) {
    throw new Error(`Vector fingerprint mismatch for ${record.id}`);
  }

  return {
    pageId: record.id,
    embedding
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
  return [...records].sort((left, right) => {
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
    rawCaptures: state.rawCaptures.map(cloneRawCapture),
    pages: state.pages.map(cloneWikiPage),
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
    rawCaptures,
    pages,
    vectors
  };
}

export function createMemoryStateAdapter(options: MemoryStateAdapterOptions): MemoryStateAdapter {
  return {
    async getCurrentState() {
      const state = cloneMemoryState(await options.getState());
      const cursor = await options.getCursor?.();

      return serializeMemoryState(state, cursor ?? '');
    },

    async applySnapshot(snapshot: SyncSnapshot) {
      await options.applyState(deserializeMemoryState(snapshot));
    }
  };
}
