# Phase 11 — Integration Surface Completion

**Effort:** ~8 hours  
**Milestone:** Standards compliance; manifest completeness  
**Scope:** Cross-package integration; standards alignment  
**Gate:** All networked integration tests passing; MCP/ACP/A2UI alignment done  
**Next:** Phase 12

---

## Overview

Complete integration across all in-development packages. Ensure standards compliance (MCP, ACP, A2UI, Skills Protocol).

---

## TASK-049..052: Package Finalization

### TASK-049: Guardrails + Runtime Policy Hooks

**Status:** TASK-PLUGIN-020..022 (Phase 4) complete

Verify policy hooks wired in runtime:

```typescript
// packages/runtime/src/guardrails/builtin/
export function registerBuiltinGuardrails(registry: HookRegistry) {
  registry.register(createInputGuardrailHook(inputPipeline));
  registry.register(createToolGuardrailHook(toolPipeline));
  registry.register(createSecretDetectionHook(secretPipeline));
  registry.register(createObservabilityHook(tracer));
}
```

### TASK-050: MCP Integration + CLI Commands

**Status:** Manifest promotion done (Phase 10)

Complete server management:

```bash
agentsy mcp list --json              # JSON output
agentsy mcp add --transport stdio file:///path/to/server
agentsy mcp add --transport http http://localhost:3000
agentsy mcp check <id>               # Health check
agentsy mcp remove <id>
```

### TASK-051: Connectors Minimal Bridge

**Status:** Phase 10 plan-only promotion

Wire core commands (no feature creep):

- Slack: `post_message(channel, text)`, `read_thread(channel, ts)`
- GitHub: Delegate to MCP via `mcp_call` tool
- Linear: Create issue via REST, store API token in secrets

### TASK-052: Retrieval Exports + Contract Alignment

**Status:** Phase 8 implementation done

Verify exports align with memory-retrieval contracts:

```typescript
// packages/retrieval/src/index.ts
export { QueryProcessor } from './query';
export { hybridRetrieve, type RetrievalResult } from './retrieval';
export { createReranker, type Reranker } from './reranking';
export { ContextBuilder, type CitationMap } from './context';

// Adapter pattern for memory integration
export { RagEngine, initRag } from './engine';
```

---

## TASK-053: Integration Tests

**Effort:** ~2 hours

Comprehensive cross-package flows:

```typescript
describe('Full Agent Loop', () => {
  test('CLI → runtime → mcp → tool → memory', async () => {
    // 1. CLI accepts user message
    // 2. Runtime applies hooks (instructions, memory pre-turn)
    // 3. Orchestrator compiles and selects agent
    // 4. Tool call requested
    // 5. MCP tool invoked
    // 6. Result captured
    // 7. Memory post-turn saves observation
  });

  test('Guardrail interception path', async () => {
    // Input guardrail blocks injection attempt
    // User notified
    // Tool hook blocks unsafe file path
    // Post-tool-call redacts secrets
  });

  test('Retrieval + memory synthesis', async () => {
    // Query triggers retrieval
    // Results stored in RAG
    // Facts extracted to memory tiers
    // Wiki synthesizes on threshold
  });
});
```

---

## TASK-096: MSW Fixture Hardening

**Effort:** ~2 hours

All networked integration suites run against MSW:

```typescript
// packages/testing/src/msw/handlers/
// ✅ providers.ts (OpenAI, Anthropic, Ollama, Gemini, Mistral, Deepseek, XAI, Perplexity, Deepinfra)
// ✅ retrieval.ts (mcp-rag-server)
// ✅ connectors.ts (Slack, GitHub, Linear)
// ✅ memory.ts (Turso, local sync)
// ✅ mcp.ts (MCP server stubs)

// Per-test override pattern:
test('provider 429 handling', () => {
  server.use(
    http.post('https://api.openai.com/v1/chat/completions', () =>
      HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    )
  );
  // Now provider returns 429; test failover
});
```

Quality: **No real HTTP calls in CI.** All tests deterministic + isolated.

---

## Standards Integration

### Tier 1 (Enhance Existing)

#### MCP (Model Context Protocol)

**Status:** ✅ Spec audit complete (2025-06-18)

**Completion:**

- ✅ Stdio + HTTP transports
- ✅ Tool registration with annotations
- ✅ Resource templates + capabilities
- ✅ No JSON-RPC batching
- ✅ `authorizationServerUrl` support

**Next:** Dynamic tool loading from plugins + MCP server discovery.

#### ACP (Agent Control Protocol)

**Status:** 🟡 Reference implementation available

**Scope:** Editor integration for VS Code, Cursor, others

Defer deep integration to Phase 12; ensure compatibility in:

- Agent definition format
- Tool invocation semantics
- State snapshot compatibility

#### A2UI / AG-UI

**Status:** 🟡 Runtime AG-UI capability exists

Ensure alignment:

- UI generation from agent responses
- Component contract matching runtime serialization
- State mutation validation

### Tier 2 (Reference)

- **Ratify** — Identity/trust model (reference only, no enforcement)
- **Skills Protocol** — Compatible with agentskills.io (Phase 4)
- **AP2** — Payments (domain-specific, defer)

---

## TASK-054: Documentation Sync

**Effort:** ~1 hour

Update all docs to reflect Phase 11 completion:

- `README.md` — Feature list up-to-date
- `docs/roadmap.md` — Phases 1-11 complete narrative
- `docs/packages.md` — All packages with manifests
- `docs/architecture/*` — Updated diagrams + descriptions
- `docs/developers/releasing.md` — Release readiness checklist
- `docs/getting-started.md` — Updated walkthrough

---

## Quality Gates

- ✅ All integration tests passing (no flakes)
- ✅ MSW mocks cover all network calls
- ✅ No circular dependencies
- ✅ All packages export cleanly
- ✅ Standards compliance verified
- ✅ Documentation accurate

---

**Next phase:** `15-PHASE-12-HARDENING-RELEASE.md`
