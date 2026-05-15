# @agentsy/memory

Memory interfaces and integration primitives for Agentsy runtime flows.

## Status

Internal package; APIs may expand as memory features mature.

## Phase 1 foundation (current)

This package now exposes a minimal Phase 1 slice for memory coordination and three-tier wiki flow scaffolding:

- Honker loader contract with fallback mode:
- `loadHonkerExtension(...)`
- In-memory coordination primitives:
- `createInMemoryPubSubManager()`
- `createInMemoryTaskQueue()`
- Three-tier wiki primitives:
- `createWikiManager()`
- `createContentProcessor()`
- `createVersionTracker()`
- `createNavigationSystem()`

These APIs are intentionally small and in-memory by default so downstream packages can integrate now while native honker/sqlite/vector backends are implemented incrementally.
