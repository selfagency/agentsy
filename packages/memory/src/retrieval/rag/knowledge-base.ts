import { createDocumentIngestor } from "./document-ingest.js";
import { createHybridRetriever } from "./hybrid-retriever.js";
import { createIndexManager } from "./index-manager.js";
import { createQueryPlanner } from "./query-planner.js";
import { rerankResults } from "./reranker.js";
import { sanitizeIngestSource } from "./sanitization.js";
import type {
  IngestSource,
  IngestSummary,
  RAGWeightConfig,
  RAGEvidence,
} from "./types.js";

export interface KnowledgeBaseManager {
  ingest(source: IngestSource): Promise<IngestSummary>;
  remove(documentId: string): Promise<boolean>;
  search(input: {
    query: string;
    scope?: string;
    limit?: number;
    weights: RAGWeightConfig;
  }): Promise<RAGEvidence[]>;
}

export function createKnowledgeBaseManager(): KnowledgeBaseManager {
  const ingestor = createDocumentIngestor();
  const index = createIndexManager();
  const retriever = createHybridRetriever();
  const planner = createQueryPlanner();

  return {
    async ingest(source) {
      const sanitized = sanitizeIngestSource(source);
      const ingestOutput = await ingestor.ingest(sanitized);
      const summary = index.upsertMany(ingestOutput.documents);

      for (const document of ingestOutput.documents) {
        retriever.upsert({
          content: document.content,
          id: document.id,
          sourceId: document.sourceId,
          sourceType: document.sourceType,
          title: document.title,
          updatedAt: document.updatedAt,
          ...(document.metadata === undefined
            ? {}
            : { metadata: { ...document.metadata } }),
        });
      }

      return summary;
    },

    async remove(documentId) {
      retriever.remove(documentId);
      return index.remove(documentId);
    },

    async search(input) {
      const planned = planner.plan({
        query: input.query,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
      });
      const results = await retriever.search(planned);
      return rerankResults(results, input.weights);
    },
  };
}
