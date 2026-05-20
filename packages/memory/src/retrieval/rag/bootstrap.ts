import type { BootstrapSummary, IngestSource, IngestSummary } from './types.js';

export interface RAGBootstrapperDeps {
  collectSources: () => Promise<IngestSource[]>;
  ingest: (source: IngestSource) => Promise<IngestSummary>;
}

export interface RAGBootstrapper {
  initialize(): Promise<BootstrapSummary>;
}

export function createRAGBootstrapper(deps: RAGBootstrapperDeps): RAGBootstrapper {
  return {
    async initialize() {
      const sources = await deps.collectSources();

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      for (const source of sources) {
        const result = await deps.ingest(source);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
      }

      return {
        totalInserted,
        totalSkipped,
        totalSources: sources.length,
        totalUpdated
      };
    }
  };
}
