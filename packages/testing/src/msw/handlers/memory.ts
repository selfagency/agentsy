/**
 * MSW request handlers for memory / RAG API endpoints.
 *
 * Simulates the RAG server endpoints (health, search, documents CRUD)
 * used by @agentsy/memory's RAGServerClient and related code.
 *
 * @module @agentsy/testing/msw/handlers/memory
 */

import { HttpResponse, http } from 'msw';
import { type HttpHandler } from 'msw';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryDocument {
  content: string;
  id: string;
  metadata?: Record<string, unknown>;
  title?: string;
}

export interface MemorySearchResult {
  content: string;
  score: number;
  title: string;
}

export interface MockMemoryState {
  documents: Map<string, MemoryDocument>;
  healthy: boolean;
  searchResults: MemorySearchResult[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMockMemoryState(): MockMemoryState {
  return {
    documents: new Map<string, MemoryDocument>(),
    healthy: true,
    searchResults: []
  };
}

// ---------------------------------------------------------------------------
// Handler factories
// ---------------------------------------------------------------------------

export interface MemoryHandlerOptions {
  /** Base URL for the RAG server (default: http://localhost:3080) */
  baseUrl?: string;
  /** Shared mutable state */
  state?: MockMemoryState;
  /** Response delay in ms (default: 0) */
  delay?: number;
}

/**
 * Create memory/RAG handlers backed by shared mutable state.
 *
 * Supports:
 * - GET /health         → health check
 * - POST /search        → search documents by query
 * - POST /documents     → upsert a document
 * - DELETE /documents/:id → delete a document
 */
export function createMemoryHandlers(options?: MemoryHandlerOptions): HttpHandler[] {
  const baseUrl = options?.baseUrl ?? 'http://localhost:3080';
  const state = options?.state ?? createMockMemoryState();
  const delay = options?.delay ?? 0;

  return [
    http.get(`${baseUrl}/health`, async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      if (!state.healthy) {
        return HttpResponse.json({ status: 'down' }, { status: 503 });
      }
      return HttpResponse.json({ status: 'ok' }, { status: 200 });
    }),

    http.post(`${baseUrl}/search`, async ({ request }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const payload = (await request.json()) as { query?: string; limit?: number };
      const query = payload.query?.toLowerCase() ?? '';
      const terms = query.split(/\s+/u).filter(Boolean);
      const limit = Math.max(1, payload.limit ?? 10);

      const results = state.searchResults
        .filter(item => {
          if (terms.length === 0) {
            return true;
          }
          const haystack = `${item.title}\n${item.content}`.toLowerCase();
          return terms.every(term => haystack.includes(term));
        })
        .slice(0, limit);

      return HttpResponse.json({ results }, { status: 200 });
    }),

    http.post(`${baseUrl}/documents`, async ({ request }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const payload = (await request.json()) as MemoryDocument;
      state.documents.set(payload.id, payload);
      return HttpResponse.json({ id: payload.id, status: 'upserted' }, { status: 200 });
    }),

    http.delete(`${baseUrl}/documents/:id`, async ({ params }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const documentId = String(params.id ?? '');
      const deleted = state.documents.delete(documentId);
      return HttpResponse.json({ deleted, id: documentId }, { status: 200 });
    })
  ];
}
