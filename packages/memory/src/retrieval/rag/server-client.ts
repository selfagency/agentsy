import type {
  RAGDeleteResult,
  RAGHealthResult,
  RAGSearchRequest,
  RAGSearchResult,
  RAGServerDocument,
} from "./types.js";

export interface RAGServerClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface RAGServerClient {
  health(): Promise<RAGHealthResult>;
  search(request: RAGSearchRequest): Promise<RAGSearchResult[]>;
  ingest(document: RAGServerDocument): Promise<void>;
  upsert(document: RAGServerDocument): Promise<void>;
  delete(documentId: string): Promise<RAGDeleteResult>;
}

async function requestJson<T>(
  baseUrl: string,
  timeoutMs: number,
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as T | null;
    return { data, ok: response.ok, status: response.status };
  } catch {
    return { data: null, ok: false, status: 0 };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function createRAGServerClient(
  options: RAGServerClientOptions
): RAGServerClient {
  const baseUrl = options.baseUrl.replace(/\/$/u, "");
  const timeoutMs = Math.max(200, options.timeoutMs ?? 3000);

  return {
    async delete(documentId) {
      const result = await requestJson<{ id?: string; deleted?: boolean }>(
        baseUrl,
        timeoutMs,
        `/documents/${encodeURIComponent(documentId)}`,
        {
          method: "DELETE",
        }
      );

      return {
        deleted: result.data?.deleted ?? false,
        id: result.data?.id ?? documentId,
      };
    },

    async health() {
      const result = await requestJson<{ status?: string }>(
        baseUrl,
        timeoutMs,
        "/health",
        {
          method: "GET",
        }
      );

      if (!result.ok) {
        return { ok: false, status: "degraded" };
      }

      return {
        ok: true,
        status: result.data?.status ?? "ok",
      };
    },

    async ingest(document) {
      await this.upsert(document);
    },

    async search(request) {
      const result = await requestJson<{ results?: RAGSearchResult[] }>(
        baseUrl,
        timeoutMs,
        "/search",
        {
          body: JSON.stringify(request),
          method: "POST",
        }
      );

      if (!result.ok) {
        return [];
      }

      return [...(result.data?.results ?? [])];
    },

    async upsert(document) {
      const result = await requestJson<Record<string, unknown>>(
        baseUrl,
        timeoutMs,
        "/documents",
        {
          body: JSON.stringify(document),
          method: "POST",
        }
      );

      if (!result.ok) {
        throw new Error(`Failed to upsert document ${document.id}`);
      }
    },
  };
}
