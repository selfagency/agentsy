export type RAGSourceType = 'wiki' | 'file' | 'document' | 'web';

export interface RAGWeightConfig {
  entity: number;
  lexical: number;
  temporal: number;
  vector: number;
}

export interface RAGWebConfig {
  allowHosts: string[];
  enabled: boolean;
}

export interface RAGConfig {
  localOnly: boolean;
  serverBaseUrl: string;
  timeoutMs: number;
  web: RAGWebConfig;
  weights: RAGWeightConfig;
}

export interface RAGServerDocument {
  chunkIndex: number;
  content: string;
  id: string;
  metadata?: Record<string, unknown>;
  sourceId: string;
  sourceType: RAGSourceType;
  title: string;
  updatedAt: string;
}

export interface RAGSearchRequest {
  limit?: number;
  query: string;
}

export interface RAGSearchResult {
  content: string;
  id: string;
  metadata?: Record<string, unknown>;
  score: number;
  sourceId: string;
  sourceType: RAGSourceType;
  title: string;
  updatedAt: string;
}

export interface RAGHealthResult {
  ok: boolean;
  status: string;
}

export interface RAGDeleteResult {
  deleted: boolean;
  id: string;
}

export interface IngestSource {
  content: string;
  metadata?: Record<string, unknown>;
  sourceId: string;
  sourceType: RAGSourceType;
  title?: string;
  updatedAt?: string;
}

export interface IngestOutput {
  documents: RAGServerDocument[];
}

export interface IngestSummary {
  inserted: number;
  skipped: number;
  updated: number;
}

export interface BootstrapSummary {
  totalInserted: number;
  totalSkipped: number;
  totalSources: number;
  totalUpdated: number;
}

export interface RAGEvidenceCitation {
  chunkIndex?: number;
  sourceId: string;
  sourceType: RAGSourceType;
  title?: string;
  url?: string;
}

export interface RAGScoreBreakdown {
  entity: number;
  final: number;
  lexical: number;
  temporal: number;
  vector: number;
}

export interface RAGEvidence {
  citations: RAGEvidenceCitation[];
  confidence: number;
  content: string;
  id: string;
  metadata?: Record<string, unknown>;
  score: number;
  scoreBreakdown: RAGScoreBreakdown;
  sourceId: string;
  sourceType: RAGSourceType;
  title: string;
  updatedAt: string;
}

export interface PlannedQuery {
  entities: string[];
  expandedTerms: string[];
  limit: number;
  query: string;
  scope?: string;
}

export interface ContextPackedEvidence {
  citations: RAGEvidenceCitation[];
  content: string;
  id: string;
  score: number;
  title: string;
}

export interface ContextPackResult {
  items: ContextPackedEvidence[];
  maxTokens: number;
  usedTokens: number;
}
