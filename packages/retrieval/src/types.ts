export type ChunkingStrategy = 'semantic' | 'fixed' | 'ast';

export interface Chunk {
  content: string;
  id: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  createdAt?: Date;
  endLine: number;
  language?: string;
  source: string;
  startLine: number;
  strategy: ChunkingStrategy;
  updatedAt?: Date;
}

export const _Chunk: Chunk = {
  content: '',
  id: '',
  metadata: {
    endLine: 1,
    source: '',
    startLine: 1,
    strategy: 'semantic'
  }
};

export const _ChunkMetadata: ChunkMetadata = {
  endLine: 1,
  source: '',
  startLine: 1,
  strategy: 'semantic'
};

export interface DataSource {
  content?: string;
  path?: string;
  type: 'file' | 'url' | 'repository' | 'database';
}

export const _DataSource: DataSource = {
  type: 'file'
};

export interface RetrievalQuery {
  embedding?: number[];
  minSimilarity?: number;
  query: string;
  topK?: number;
}

export const _RetrievalQuery: RetrievalQuery = {
  query: ''
};

export interface SearchResult {
  documents: SearchDocument[];
  queryTime: number;
  total: number;
}

export const _SearchResult: SearchResult = {
  documents: [],
  queryTime: 0,
  total: 0
};

export interface SearchDocument {
  chunkId?: string;
  content: string;
  id: string;
  score?: number;
  similarity?: number;
}

export const _SearchDocument: SearchDocument = {
  content: '',
  id: ''
};

export interface Document {
  chunks: Chunk[];
  content: string;
  id: string;
  metadata?: DocumentMetadata;
  source?: string;
}

export const _Document: Document = {
  chunks: [],
  content: '',
  id: ''
};

export interface DocumentMetadata {
  chunkCount?: number;
  indexedAt?: string;
  tags?: string[];
}

export const _DocumentMetadata: DocumentMetadata = {};

export const ChunkingStrategy = {
  AST: 'ast',
  FIXED: 'fixed',
  SEMANTIC: 'semantic'
} as const;
