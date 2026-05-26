/**
 * MSW request handlers for retrieval / embedding API endpoints.
 *
 * Simulates embedding service endpoints used by @agentsy/memory's retrieval
 * infrastructure and related code.
 *
 * @module @agentsy/testing/msw/handlers/retrieval
 */

import { HttpResponse, http } from 'msw';
import { type HttpHandler } from 'msw';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingResult {
  embedding: number[];
  index: number;
}

export interface MockRetrievalState {
  dimensions: number;
  embeddings: Map<string, number[]>;
  healthy: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMockRetrievalState(): MockRetrievalState {
  return {
    dimensions: 1536,
    embeddings: new Map<string, number[]>(),
    healthy: true
  };
}

// ---------------------------------------------------------------------------
// Handler factories
// ---------------------------------------------------------------------------

export interface RetrievalHandlerOptions {
  /** Base URL for the retrieval service (default: http://localhost:3081) */
  baseUrl?: string;
  /** Shared mutable state */
  state?: MockRetrievalState;
  /** Response delay in ms (default: 0) */
  delay?: number;
}

/**
 * Create retrieval/embedding handlers backed by shared mutable state.
 *
 * Supports:
 * - GET /health          → health check
 * - POST /embed          → generate embeddings for text
 * - POST /re-rank        → re-rank documents by relevance
 * - DELETE /embeddings/:id → delete stored embedding
 */
export function createRetrievalHandlers(options?: RetrievalHandlerOptions): HttpHandler[] {
  const baseUrl = options?.baseUrl ?? 'http://localhost:3081';
  const state = options?.state ?? createMockRetrievalState();
  const delay = options?.delay ?? 0;
  const dims = state.dimensions;

  return [
    http.get(`${baseUrl}/health`, async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      if (!state.healthy) {
        return HttpResponse.json({ status: 'down' }, { status: 503 });
      }
      return HttpResponse.json({ dimensions: dims, status: 'ok' }, { status: 200 });
    }),

    http.post(`${baseUrl}/embed`, async ({ request }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const payload = (await request.json()) as { texts?: string[] };
      const texts = payload.texts ?? [];
      const embeddings: EmbeddingResult[] = texts.map((text, index) => ({
        embedding: Array.from({ length: dims }, (_, i) => ((index + 1) * (i + 1)) / dims),
        index
      }));
      return HttpResponse.json({ embeddings, model: 'text-embedding-mock' }, { status: 200 });
    }),

    http.post(`${baseUrl}/re-rank`, async ({ request }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const payload = (await request.json()) as {
        documents?: string[];
        query?: string;
      };
      const docs = payload.documents ?? [];
      const query = payload.query ?? '';
      const results = docs.map((doc, index) => ({
        index,
        relevance_score: doc.toLowerCase().includes(query.toLowerCase()) ? 0.95 - index * 0.05 : 0.1,
        text: doc
      }));
      return HttpResponse.json({ results }, { status: 200 });
    }),

    http.delete(`${baseUrl}/embeddings/:id`, async ({ params }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const embeddingId = String(params.id ?? '');
      const deleted = state.embeddings.delete(embeddingId);
      return HttpResponse.json({ deleted, id: embeddingId }, { status: 200 });
    })
  ];
}
