import { describe, expect, it } from 'vitest';

import { createRAGBootstrapper } from './bootstrap.js';

describe('RAG bootstrapper', () => {
  it('auto-ingests configured startup sources with deterministic document IDs', async () => {
    const calls: string[] = [];
    const bootstrapper = createRAGBootstrapper({
      collectSources: async () => [
        {
          sourceId: 'docs:README',
          sourceType: 'file',
          content: 'OAuth refresh flow and token lifetime docs.'
        }
      ],
      ingest: async input => {
        calls.push(input.sourceId);
        return { inserted: 1, updated: 0, skipped: 0 };
      }
    });

    const result = await bootstrapper.initialize();

    expect(calls).toEqual(['docs:README']);
    expect(result.totalSources).toBe(1);
    expect(result.totalInserted).toBe(1);
  });
});
