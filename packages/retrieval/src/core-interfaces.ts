/**
 * Core interfaces for retrieval operations
 */

import type {
  Chunk,
  ChunkingStrategy,
  ChunkMetadata,
  DataSource,
  Document,
  RetrievalQuery,
  SearchResult,
} from './types.js';

export interface IndexingPipeline {
  /**
   * Index a data source for search
   */
  index(source: DataSource): Promise<IndexingResult>;

  /**
   * Chunk content using the specified strategy
   */
  chunk(content: string, strategy: ChunkingStrategy): Chunk[];

  /**
   * Index a single document page for search
   */
  indexPage(page: Document): Promise<void>;

  /**
   * Remove a page from index
   */
  removePage(id: string): Promise<void>;

  /**
   * 遗留接口 (保留向后兼容)
   */
  legacyIndexPage?(page: Document): Promise<void>;
}

export interface RetrievalEngine {
  /**
   * Search for relevant chunks based on a query
   */
  search(query: RetrievalQuery): Promise<SearchResult>;

  /**
   * Index a single document page for search
   */
  indexPage(page: Document): Promise<void>;

  /**
   * Remove a page from index
   */
  removePage(id: string): Promise<void>;

  /**
   * 遗产接口 (保留向后兼容)
   */
  legacyIndexPage?(page: Document): Promise<void>;
}

export interface Page {
  id: string;
  title: string;
  url?: string;
  content: string;
  lastUpdated?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface IndexingResult {
  documentCount: number;
  chunkCount: number;
  lastIndexed?: Date;
}

export interface RetrievalResult {
  content: string;
  metadata: ChunkMetadata;
  similarity: number;
  source: DataSource;
  url?: string;
}

export interface RetrievalEngineCustom {
  /**
   * Search for relevant chunks based on a query
   */
  search(query: RetrievalQuery): Promise<SearchResult>;

  /**
   * Index a single document page for search
   */
  indexPage(page: Document): Promise<void>;

  /**
   * Remove a page from index
   */
  removePage(id: string): Promise<void>;

  /**
   * 遗留接口 (保留向后兼容)
   */
  legacyIndexPage?(page: Document): Promise<void>;
}

export interface Page {
  id: string;
  title: string;
  url?: string;
  content: string;
  lastUpdated?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface IndexingResult {
  documentCount: number;
  chunkCount: number;
  lastIndexed?: Date;
}

export interface RetrievalEngine {
  /**
   * Search for relevant chunks based on a query
   */
  search(query: RetrievalQuery): Promise<SearchResult>;

  /**
   * Index a single document page for search
   */
  indexPage(page: Document): Promise<void>;

  /**
   * Remove a page from index
   */
  removePage(id: string): Promise<void>;

  /**
   * 遗产接口 (保留向后兼容)
   */
  legacyIndexPage?(page: Document): Promise<void>;
}

export interface RetrievalResult {
  content: string;
  metadata: ChunkMetadata;
  similarity: number;
  source: DataSource;
  url?: string;
}
