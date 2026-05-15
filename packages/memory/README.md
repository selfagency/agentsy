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
