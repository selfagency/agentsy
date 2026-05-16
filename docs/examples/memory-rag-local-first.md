# Local-first memory RAG + runtime injection (advanced)

This example shows a Phase 3 retrieval flow:

1. Build local-first RAG config.
2. Ingest wiki/doc sources into a memory knowledge base.
3. Run hybrid retrieval + reranking.
4. Pack evidence under a token budget.
5. Inject citation-preserving memory context into a runtime prompt.

## Packages used

```bash
npm install @agentsy/memory @agentsy/runtime
```

## Illustrative implementation

```ts
import {
  createKnowledgeBaseManager,
  createQueryPlanner,
  createRAGConfig,
  packEvidenceForContext,
  rerankResults,
} from "@agentsy/memory";
import {
  buildRuntimeMemoryContextXml,
  injectRuntimeMemoryContext,
} from "@agentsy/runtime";

export async function buildPromptWithMemory(
  query: string,
  promptBody: string
): Promise<string> {
  const config = createRAGConfig({
    localOnly: true,
    web: { enabled: false },
  });

  const kb = createKnowledgeBaseManager();

  await kb.ingest({
    sourceId: "wiki:oauth-policy",
    sourceType: "wiki",
    title: "OAuth policy",
    content: "Use short-lived access tokens and rotate refresh tokens.",
    metadata: { entities: ["oauth", "token", "refresh"] },
  });

  const planner = createQueryPlanner();
  const planned = planner.plan({ query, scope: "project", limit: 5 });

  const retrieved = await kb.search({
    query: planned.query,
    scope: planned.scope,
    limit: planned.limit,
    weights: config.weights,
  });

  const reranked = rerankResults(retrieved, config.weights);
  const packed = packEvidenceForContext(reranked, {
    maxTokens: 180,
    includeCitations: true,
  });

  const contextXml = buildRuntimeMemoryContextXml(
    packed.items.map((item) => ({
      id: item.id,
      scope: "project",
      score: item.score,
      title: item.title,
      content: item.content,
      citations: item.citations,
    }))
  );

  return injectRuntimeMemoryContext(promptBody, contextXml);
}
```

## Why this pattern is useful

- Keeps baseline retrieval local-first and privacy-oriented.
- Preserves provenance with explicit citation metadata in prompt context.
- Enforces token budgets before memory injection.
- Degrades safely if remote retrieval is unavailable.
