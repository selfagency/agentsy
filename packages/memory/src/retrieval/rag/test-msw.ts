import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import type { RAGSearchResult, RAGServerDocument } from "./types.js";

export interface MockRAGState {
  healthy: boolean;
  documents: Map<string, RAGServerDocument>;
  searchResults: RAGSearchResult[];
}

export function createMockRAGState(): MockRAGState {
  return {
    documents: new Map<string, RAGServerDocument>(),
    healthy: true,
    searchResults: [],
  };
}

function createRAGHandlers(baseUrl: string, state: MockRAGState) {
  return [
    http.get(`${baseUrl}/health`, () => {
      if (!state.healthy) {
        return HttpResponse.json({ status: "down" }, { status: 503 });
      }

      return HttpResponse.json({ status: "ok" }, { status: 200 });
    }),
    http.post(`${baseUrl}/search`, async ({ request }) => {
      const payload = (await request.json()) as {
        query?: string;
        limit?: number;
      };
      const query = payload.query?.toLowerCase() ?? "";
      const terms = query.split(/\s+/u).filter(Boolean);
      const limit = Math.max(1, payload.limit ?? 10);
      const results = state.searchResults
        .filter((item) => {
          if (terms.length === 0) {
            return true;
          }

          const haystack = `${item.title}\n${item.content}`.toLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, limit);

      return HttpResponse.json({ results }, { status: 200 });
    }),
    http.post(`${baseUrl}/documents`, async ({ request }) => {
      const payload = (await request.json()) as RAGServerDocument;
      state.documents.set(payload.id, payload);
      return HttpResponse.json(
        { id: payload.id, status: "upserted" },
        { status: 200 }
      );
    }),
    http.delete(`${baseUrl}/documents/:id`, ({ params }) => {
      const documentId = String(params.id ?? "");
      const deleted = state.documents.delete(documentId);
      return HttpResponse.json({ deleted, id: documentId }, { status: 200 });
    }),
  ];
}

export function createRAGMockServer(baseUrl: string, state: MockRAGState) {
  return setupServer(...createRAGHandlers(baseUrl, state));
}
