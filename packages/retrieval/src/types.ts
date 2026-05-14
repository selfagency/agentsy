export type ChunkingStrategy = 'semantic' | 'fixed' | 'ast';

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  source: string;
  startLine: number;
  endLine: number;
  strategy: ChunkingStrategy;
  language?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const _Chunk: Chunk = {
  id: '',
  content: '',
  metadata: {
    source: '',
    startLine: 1,
    endLine: 1,
    strategy: 'semantic'
  }
};

export const _ChunkMetadata: ChunkMetadata = {
  source: '',
  startLine: 1,
  endLine: 1,
  strategy: 'semantic'
};

export interface DataSource {
  type: 'file' | 'url' | 'repository' | 'database';
  path?: string;
  content?: string;
}

export const _DataSource: DataSource = {
  type: 'file'
};

export interface RetrievalQuery {
  query: string;
  topK?: number;
  minSimilarity?: number;
  embedding?: number[];
}

export const _RetrievalQuery: RetrievalQuery = {
  query: ''
};

export interface SearchResult {
  documents: SearchDocument[];
  total: number;
  queryTime: number;
}

export const _SearchResult: SearchResult = {
  documents: [],
  total: 0,
  queryTime: 0
};

export interface SearchDocument {
  id: string;
  content: string;
  chunkId?: string;
  score?: number;
  similarity?: number;
}

export const _SearchDocument: SearchDocument = {
  id: '',
  content: ''
};

export interface Document {
  id: string;
  content: string;
  chunks: Chunk[];
  source?: string;
  metadata?: DocumentMetadata;
}

export const _Document: Document = {
  id: '',
  content: '',
  chunks: []
};

export interface DocumentMetadata {
  chunkCount?: number;
  indexedAt?: string;
  tags?: string[];
}

export const _DocumentMetadata: DocumentMetadata = {};

export const ChunkingStrategy = {
  SEMANTIC: 'semantic',
  FIXED: 'fixed',
  AST: 'ast'
} as const;