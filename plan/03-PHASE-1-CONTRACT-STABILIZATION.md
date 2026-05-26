# Phase 1 — Cross-Package Contract Stabilization

**Effort:** ~2 hours  
**Packages:** `@agentsy/types`, `@agentsy/testing`  
**Gate:** `pnpm check-types` + `pnpm test` monorepo green  
**Next:** Phase 2

---

## Overview

Stabilize cross-package APIs. All manifest-bearing packages export reusable, typed, documented interfaces.

**Key**: Establish MSW v2 as canonical HTTP mock layer for all network-facing tests.

---

## TASK-090: Manifest API Posture Audit

**Scope:** Every package with exported APIs

**Checklist per package:**

| Check                   | Applies         | Verification                                                            |
| ----------------------- | --------------- | ----------------------------------------------------------------------- |
| **Type exports**        | All             | `export interface`, `export type`, `export enum` (never `export = ...`) |
| **Stable versioning**   | Public packages | SemVer in package.json                                                  |
| **Entry point clarity** | All             | Single `src/index.ts` that re-exports stable APIs                       |
| **Example usage**       | Core packages   | `README.md` or `src/examples/` with runnable examples                   |
| **TSDoc**               | New exports     | `/** Comment */` on public types + methods                              |
| **Backward compat**     | Existing        | Breaking change requires major version bump + migration guide           |

**Critical packages to audit:**

1. `@agentsy/types` — All interfaces exported cleanly? ✅ (TASK-067)
2. `@agentsy/memory` — MemoryEngine, WikiManager, KnowledgeBase interfaces stable?
3. `@agentsy/core` — StreamEventAdapter, CompletionRequest/Response types stable?
4. `@agentsy/runtime` — HookRegistry, AgentLoopOptions types stable?
5. `@agentsy/orchestrator` — createAgentSession, HookCompiler stable?
6. `@agentsy/session` — SessionStore interface, SessionState schema stable?
7. `@agentsy/observability` — Tracer, Logger, Span types stable?
8. `@agentsy/tokens` — Compression, TokenBudget types stable?

**Delivery:**

Create `packages/API-POSTURE-MATRIX.md`:

```markdown
# API Posture Matrix (2026-05-25)

| Package         | Entry Point | Type Exports | Docs | Status     |
| --------------- | ----------- | ------------ | ---- | ---------- |
| @agentsy/types  | ✅          | ✅           | ✅   | 🟢 Stable  |
| @agentsy/memory | ✅          | ✅           | 🟡   | 🟡 Audited |
| @agentsy/core   | ✅          | ✅           | 🟡   | 🟡 Audited |

...
```

---

## TASK-095: MSW v2 Bootstrap

**Location:** `packages/testing/src/msw/`

**Scope:** Shared HTTP mock handlers for cross-package tests

**Structure:**

```text
packages/testing/
├── src/
│   ├── msw/
│   │   ├── index.ts (setupServer export)
│   │   ├── handlers/
│   │   │   ├── providers.ts (OpenAI, Anthropic, Ollama, etc)
│   │   │   ├── retrieval.ts (RAG endpoints)
│   │   │   ├── connectors.ts (external integrations)
│   │   │   └── memory.ts (Turso endpoints)
│   │   └── fixtures/
│   │       ├── openai-response.json
│   │       ├── anthropic-response.json
│   │       └── error-cases.json
│   └── __tests__/
│       └── msw-integration.test.ts
```

**Deliverables:**

1. **MSW Server Bootstrap** (`setupServer()`)

   ```typescript
   import { setupServer } from 'msw/node';
   import * as handlers from './handlers';

   export const server = setupServer(...Object.values(handlers).flat());
   ```

2. **Handler Sets**

   | Handler         | Coverage                                                  |
   | --------------- | --------------------------------------------------------- |
   | `providers.ts`  | OpenAI, Anthropic, Ollama, Gemini, Mistral mock responses |
   | `retrieval.ts`  | mcp-rag-server endpoints (search, ingest, cite)           |
   | `connectors.ts` | External service stubs                                    |
   | `memory.ts`     | Turso API mocks + @tursodatabase/sync simulation          |

3. **Test Pattern** (in any package)

   ```typescript
   import { server } from '@agentsy/testing/msw';

   beforeAll(() => server.listen());
   afterEach(() => server.resetHandlers());
   afterAll(() => server.close());

   test('provider request', () => {
     // Uses mock server automatically
   });
   ```

4. **Per-Test Overrides**

   ```typescript
   test('custom error', () => {
     server.use(
       http.post('https://api.openai.com/...', () => {
         return HttpResponse.json({ error: '...' }, { status: 500 });
       })
     );
   });
   ```

**Quality gates:**

- ✅ All handler sets tested (`msw-integration.test.ts`)
- ✅ Per-package tests use MSW (no real network calls in CI)
- ✅ Fixture payloads match actual API responses

---

## Integration Plan

### Week 1: Type Audit

1. Run TASK-090 on all 8 critical packages
2. Document findings in API-POSTURE-MATRIX.md
3. File issues for any breaking inconsistencies

### Week 2: MSW Bootstrap

1. Implement handler sets (providers, retrieval, connectors, memory)
2. Create test pattern documentation
3. Wire into CI: `pnpm test -- --no-network`

### Week 3: Verification

1. Audit existing cross-package tests
2. Migrate to MSW where needed
3. Verify `pnpm test` monorepo-wide green

---

## Quality Gates

- ✅ `pnpm check-types` monorepo green
- ✅ `pnpm test` monorepo green (no real HTTP calls)
- ✅ API-POSTURE-MATRIX.md complete
- ✅ All packages use MSW for network tests
- ✅ No `fetch()` / `http.request()` calls in test code (blocked via linter rule)

---

## Success Criteria

✅ All public APIs have stable exports  
✅ Cross-package type mismatches resolved  
✅ MSW v2 is canonical mock layer  
✅ Test isolation guaranteed (no real network)  
✅ Documentation updated

---

**Next phase:** `04-PHASE-2-TUI-VERTICAL-SLICE.md`
