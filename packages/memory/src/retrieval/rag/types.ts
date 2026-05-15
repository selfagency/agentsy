export type RAGSourceType = 'wiki' | 'file' | 'document' | 'web';

export interface RAGWeightConfig {
  vector: number;
  lexical: number;
  entity: number;
  temporal: number;
}

export interface RAGWebConfig {
  enabled: boolean;
  allowHosts: string[];
}

export interface RAGConfig {
  localOnly: boolean;
  serverBaseUrl: string;
  timeoutMs: number;
  weights: RAGWeightConfig;
  web: RAGWebConfig;
}

export interface RAGServerDocument {
  id: string;
  sourceId: string;
  sourceType: RAGSourceType;
  title: string;
  content: string;
  chunkIndex: number;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RAGSearchRequest {
  query: string;
  limit?: number;
}

export interface RAGSearchResult {
  id: string;
  sourceId: string;
  sourceType: RAGSourceType;
  title: string;
  content: string;
  score: number;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RAGHealthResult {
  ok: boolean;
  status: string;
}

export interface RAGDeleteResult {
  id: string;
  deleted: boolean;
}

export interface IngestSource {
  sourceId: string;
  sourceType: RAGSourceType;
  title?: string;
  content: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestOutput {
  documents: RAGServerDocument[];
}

export interface IngestSummary {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface BootstrapSummary {
  totalSources: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
}

export interface RAGEvidenceCitation {
  sourceId: string;
  sourceType: RAGSourceType;
  title?: string;
  chunkIndex?: number;
  url?: string;
}

export interface RAGScoreBreakdown {
  vector: number;
  lexical: number;
  entity: number;
  temporal: number;
  final: number;
}

export interface RAGEvidence {
  id: string;
  sourceId: string;
  sourceType: RAGSourceType;
  title: string;
  content: string;
  score: number;
  confidence: number;
  updatedAt: string;
  scoreBreakdown: RAGScoreBreakdown;
  citations: RAGEvidenceCitation[];
  metadata?: Record<string, unknown>;
}

export interface PlannedQuery {
  query: string;
  scope?: string;
  expandedTerms: string[];
  entities: string[];
  limit: number;
}

export interface ContextPackedEvidence {
  id: string;
  title: string;
  content: string;
  score: number;
  citations: RAGEvidenceCitation[];
}

export interface ContextPackResult {
  items: ContextPackedEvidence[];
  usedTokens: number;
  maxTokens: number;
}
