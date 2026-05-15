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

## Phase 2 sync layer (current)

Phase 2 is now implemented for the local-first sync scope in this package. The package uses the Turso TypeScript sync SDK (`@tursodatabase/sync`) for a local SQLite replica with remote synchronization semantics, while keeping the higher-level memory APIs independent from the transport.

### Sync runtime surface

- `createTursoManager()`
- `createDefaultTursoClient()`
- `createTursoSyncClient()`
- `createNoopTursoClient()`
- `createSyncScheduler()`
- `createBackupManager()`
- `createBackupManifest()` / `verifyBackupManifest()`
- `collectConflicts()` / `resolveConflict()` / `createConflictStore()`
- `computeSyncChecksum()` / `verifySyncChecksum()` / `validateRemoteSnapshot()`
- `createSyncMetricsRegistry()`
- `createSecureSyncErrorEnvelope()` / `redactSyncSecrets()` / `validateCredentialSource()`

### Phase 2 behavior

- typed sync records, snapshots, status, metrics, and backup contracts
- Turso-backed local replica transport via `@tursodatabase/sync`
- deterministic conflict collection and policy-based conflict resolution
- manual-conflict persistence via pluggable `ConflictStore`
- retry-aware sync scheduling with jitter and exponential backoff
- backup manifest generation, verification, restore, and rollback helpers
- checksum/integrity validation for snapshots
- credential-source validation and secret redaction for diagnostics
- metrics registry for sync/backup/restore counters and latency summaries
- integration coverage for manager + scheduler + backup workflows

### Turso sync usage

The recommended remote-sync transport for this package is Turso Sync, not the legacy `@libsql/client` path.

```ts
import { createTursoManager } from '@agentsy/memory';

const manager = createTursoManager({
  path: './.agentsy/memory-sync.db',
  databaseUrl: process.env.TURSO_DATABASE_URL ?? 'http://localhost:8080',
  authToken: process.env.TURSO_AUTH_TOKEN ?? '',
  syncIntervalMs: Number(process.env.AGENTSY_MEMORY_SYNC_INTERVAL_MS ?? 5_000),
  maxRetries: 3,
  clientName: 'agentsy-memory',
  tracing: 'warn',
  mergePolicy: 'lastWriteWins',
  mode: 'remote-shadow',
  credentialSource: 'environment'
});
```

When `path` is provided, `createTursoManager()` will build a default Turso Sync transport using `createDefaultTursoClient()`, which delegates to `createTursoSyncClient()`.

### Local sync server development

For local development, Turso Sync supports a local sync server endpoint such as `http://localhost:8080`. This package treats localhost endpoints as development-friendly and does not require an auth token for those URLs.

### Environment variables

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `AGENTSY_MEMORY_SYNC_INTERVAL_MS`

These are not required for local-only operation, but they are the canonical configuration keys for Phase 2 remote sync hosts.

## Validation status

- `pnpm --filter @agentsy/memory check-types` ✅
- `pnpm --filter @agentsy/memory test` ✅

See `plan/PHASE-1-COMPLETION.md` and `plan/PHASE-2-COMPLETION.md` for detailed completion and verification notes.
