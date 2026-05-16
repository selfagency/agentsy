export interface RetrievalBenchmarkDocument {
  id: string;
  sourceId: string;
  sourceType: "wiki" | "file" | "document" | "web";
  title: string;
  content: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievalBenchmarkResult {
  latencyMs: number;
  topId: string | null;
  hitCount: number;
  citationCoverage: number;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function lexicalScore(
  queryTokens: readonly string[],
  document: RetrievalBenchmarkDocument
): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const text = `${document.title}\n${document.content}`.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (text.includes(token)) {
      hits += 1;
    }
  }

  return hits / queryTokens.length;
}

function entityScore(
  queryTokens: readonly string[],
  document: RetrievalBenchmarkDocument
): number {
  const entities = document.metadata?.entities;
  if (
    !Array.isArray(entities) ||
    entities.length === 0 ||
    queryTokens.length === 0
  ) {
    return 0;
  }

  const normalized = new Set(
    entities
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toLowerCase())
  );
  let hits = 0;
  for (const token of queryTokens) {
    if (normalized.has(token)) {
      hits += 1;
    }
  }

  return hits / queryTokens.length;
}

function temporalScore(updatedAtIso: string): number {
  const updated = Date.parse(updatedAtIso);
  if (Number.isNaN(updated)) {
    return 0;
  }

  const ageHours = Math.max(0, Date.now() - updated) / (1000 * 60 * 60);
  return 1 / (1 + ageHours / 24);
}

function estimateTokens(input: string): number {
  return Math.max(1, Math.ceil(input.length / 4));
}

export async function runRetrievalBenchmark(
  documents: readonly RetrievalBenchmarkDocument[],
  query: string
): Promise<RetrievalBenchmarkResult> {
  const queryTokens = tokenize(query);
  const limit = 5;

  const start = performance.now();
  const ranked = [...documents]
    .map((document) => {
      const lexical = lexicalScore(queryTokens, document);
      const entity = entityScore(queryTokens, document);
      const temporal = temporalScore(document.updatedAt);
      const score = lexical * 0.7 + entity * 0.2 + temporal * 0.1;
      return { ...document, score };
    })
    .toSorted((left, right) => right.score - left.score)
    .slice(0, limit);

  let budget = 120;
  const packed = ranked.filter((document) => {
    const tokens = estimateTokens(`${document.title}\n${document.content}`);
    if (tokens > budget) {
      return false;
    }

    budget -= tokens;
    return true;
  });
  const latencyMs = performance.now() - start;

  const totalCitations = packed.reduce((sum: number, item) => {
    const entities = item.metadata?.entities;
    return sum + (Array.isArray(entities) && entities.length > 0 ? 1 : 0);
  }, 0);
  const citationCoverage =
    packed.length === 0 ? 0 : totalCitations / packed.length;

  return {
    citationCoverage,
    hitCount: ranked.length,
    latencyMs,
    topId: ranked[0]?.id ?? null,
  };
}
