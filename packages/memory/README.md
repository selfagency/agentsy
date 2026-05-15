# @agentsy/memory

Memory interfaces and integration primitives for Agentsy runtime flows.

## Status

Internal package; APIs may expand as memory features mature.

## Phase 1 foundation (current)

Phase 1 is now fully implemented for the local-first foundation scope in this package.

### Coordination and atomic safety

- Honker extension loader + fallback mode:
  - `loadHonkerExtension(...)`
- In-memory coordination primitives:
  - `createInMemoryPubSubManager()`
  - `createInMemoryTaskQueue()`
  - `createInMemoryScheduler()`
- Cross-layer atomic orchestration:
  - `createAtomicWorkflowCoordinator()`

### Wiki pipeline (`raw -> wiki -> vector`)

- `createWikiManager()`
- `createContentProcessor()`
- `createVersionTracker()`
- `createNavigationSystem()`
- `createEntityExtractor()`
- `createLocalEmbeddingEngine()`

### Retrieval and injection

- Hybrid retriever (semantic + lexical + temporal):
  - `createMemoryRetriever()`
- XML context injection utilities:
  - `formatMemoryContextXml(...)`
  - `injectMemoryContext(...)`

### Scope isolation

- Deny-by-default scope policy manager:
  - `createScopeManager()`
- Supported scopes:
  - `session | user | project | team | global`

### Tool surface for loop integration

- `createMemoryCaptureTool()`
- `createMemorySearchTool()`
- `createMemoryListTool()`
- `createMemoryStatsTool()`
- `createMemoryLintTool()`

### Observability

- `createMemoryMetrics()`
- `redactSecretLikeValues(...)`

## Validation status

- `pnpm --filter @agentsy/memory check-types` ✅
- `pnpm --filter @agentsy/memory test` ✅

See `plan/PHASE-1-COMPLETION.md` for detailed completion and verification notes.

## Phase 3 RAG enhancement (current)

Phase 3 retrieval capabilities are now implemented for local-first knowledge workflows.

### RAG integration surface

- `createRAGConfig()`
- `createRAGServerClient()`
- `createKnowledgeBaseManager()`
- `createRAGBootstrapper()`
- `createDocumentIngestor()`
- `createSourceConnectors()`
- `createIndexManager()`
- `createReindexScheduler()`
- `sanitizeIngestSource()`

### Retrieval quality and context assembly

- `createHybridRetriever()` (vector + lexical + entity + temporal)
- `rerankResults()`
- `createQueryPlanner()`
- `packEvidenceForContext()`
- typed evidence/citation contracts from `src/retrieval/rag/types.ts`

### Retrieval observability

- `createRAGMetrics()` for latency, hit-rate, source mix, and citation coverage

### Runtime bridge

Phase 3 also adds runtime-side citation-preserving context helpers in `@agentsy/runtime`:

- `buildRuntimeMemoryContextXml()`
- `injectRuntimeMemoryContext()`

### Validation status (Phase 3)

- `pnpm --filter @agentsy/memory check-types` ✅
- `pnpm --filter @agentsy/memory test` ✅
- `pnpm --filter @agentsy/runtime check-types` ✅
- `pnpm --filter @agentsy/runtime test` ✅
- `pnpm --filter @agentsy/testing check-types` ✅
- `pnpm --filter @agentsy/testing test` ✅

See `plan/PHASE-3-COMPLETION.md` for detailed evidence.
