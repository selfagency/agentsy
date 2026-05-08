# Revised Implementation Architecture

## Executive Summary

**Goal:** Composable platform architecture consolidating the 42 scattered package directories into ~22-25 well-organized packages, with clear separation between stream processing (core), provider integration (providers), and agent-level capabilities (agents, plugins, cli).

**Status:** 21 published packages, ~21-24 packages target after consolidation.

**Current State:** 42 package directories → need consolidation into ~22-25 packages
**Target Architecture:** Tiered package structure: Core → Providers → Agents/Plugins/CLI/Testing → Platform Surface

---

## Architecture Principles

1. **Modular by Default, Composable by Design:** Packages are independent but expose pluggable components
2. **Subpath Exports for Granularity:** Stream processing dedicated components → core/, provider-specific code → providers/\*/subfolders
3. **Stream Processing Bundled:** fundamental parsing/shaping utilities consolidated into ONE core package
4. **Core vs Platform:** Core contains stream processing; platform contains agent capabilities (agents, plugins, cli)
5. **Validation Gates:** Each phase has clear success criteria before progressing (Tier 0→1→2→3→4)
6. **Three distinct agent-interop layers:** subagents (local orchestration), ACP (editor/client protocol), A2A (agent-to-agent protocol) — NOT one monolithic abstraction
7. **Plugins are the agent extension system:** plugin architecture + example specialized agents (caveman, superpowers, garry's mode)
8. **Connectors are for third-party comms platforms:** WhatsApp, Matrix, Telegram, Email — NOT merged into tools

---

## Key Architectural Clarifications

### ACP (Two Separate Systems)

1. **ACP Client** (`@agentsy/acp`): Editor/client protocol for agent sessions
   - Session-based control protocol for editor-to-agent interaction
   - Transport: stdio/JSON-RPC (local) or HTTP/WebSocket (remote)
   - File/terminal operations through gated permissions
   - VS Code integration without hard-coding UI logic
   - See: `plan/agentsy-acp-client.md`

2. **ACP (Agent Communication Protocol)**: Agent-to-agent protocol
   - Similar to A2A but for the ACP ecosystem
   - Agent-to-agent coordination and communication
   - Part of the multi-agent interoperability story alongside A2A

### Three-Layer Agent Interop Design

Per `plan/agentsy-subagents.md`:

- `@agentsy/subagents` — Local orchestration (coordinator/worker, fan-out, chained delegation)
- `@agentsy/acp` + `@agentsy/acp-client` — Editor/client-facing protocol (sessions, permissions, workspace ops)
- `@agentsy/a2a` — Remote agent-to-agent interoperability (Agent Cards, discovery, transport)

These should NOT be combined into one monolithic agent package. They serve different purposes.

### Memory (3 Dimensions)

Per `plan/agentsy-memory.md` and `plan/agentsy-tech.md`:

- **Layer 0: Raw Event Log** — Append-only JSONL session history with cursor-based replay
- **Layer 1: Synthesized Wiki** — Durable knowledge pages (entities, concepts, synthesis, sources)
- **Layer 2: Vector Retrieval** — libSQL/Turso vector search over wiki pages
- **Scope boundaries**: session, user, project, team, global
- **White-box editing**: read, create, update, delete memory entries at runtime
- **Safety model**: prompt-injection detection, privacy tags, trust tiers, scope guards

### Retrieval (Vector + Document Store)

Per `plan/agentsy-tech.md` section 4.12:

- **VectorStore interface**: insert, insertBatch, search, delete, stats
- **EmbeddingProvider interface**: embed, embedBatch, dimensionality
- **RetrievalEngine**: indexPage, indexPages, removePage, search, fullTextSearch
- **Backend**: `{ backend: 'libsql'; path: string }` or `{ backend: 'turso'; url: string; authToken: string }` or `{ backend: 'custom'; store: VectorStore }`
- **RAG**: dump files → vectorize → make available for retrieval (NOT just wiki-based)

### Session (Crash-Safe Persistence)

Per `plan/agentsy-tech.md` section 4.7:

- **SessionStore interface**: saveUser, saveAssistant, save, load, list, delete, loadAsSnapshot
- **FileSystemSessionStore**: Atomic writes (.tmp → verify → rename), lazy session file creation
- **StreamSnapshot**: sessionId, messages, stepIndex, metadata, createdAt, updatedAt
- **Process-prefix support**: Prefix session IDs with PID for process isolation

### Connectors (Third-Party Comms)

Per `plan/agentsy-connectors-v1.md`:

- **Signal, WhatsApp, Matrix, Telegram, IMAP/SMTP email** adapters
- **Custom adapter interface**: `createCustomAdapter<TConfig>(spec: CustomAdapterSpec<TConfig>): ChannelAdapter<TConfig>`
- **ChannelAdapter interface**: onConnect, onDisconnect, onMessage, send
- **Security**: env-var credentials, HMAC verification, TLS enforcement, E2E encryption for Matrix
- **Connectors are for connections to third-party communications platforms** — NOT merged into tools

### Pacing → Tokens

Per `plan/pacing-function-implementation.md`:

- Pacing (rate-aware execution, dead-time utilization) merges into `@agentsy/tokens` (renamed from token-economy)
- Token economy handles budgets, reduction strategies, shaping, and now rate-aware pacing

### Agents vs Plugins

- **agents/** → Local orchestration (A2A protocol + subagents coordinator/worker)
- **plugins/** → Plugin architecture + example specialized agents (caveman mode, superpowers mode, garry's mode)
  - Plugin system: AgentModeFactory interface, context-signal activation, SKILL.md bundling
  - See: `plan/agentsy-agents-v1.md` for caveman/superpowers/garry's mode specs

---

## Package Consolidation Summary

### **Consolidation Targets:**

| Category                  | Before                                                  | After                           | Count Change |
| ------------------------- | ------------------------------------------------------- | ------------------------------- | ------------ |
| **Tier 0: Core**          | 7 separate packages                                     | 1 **core** package              | 7 → 1        |
| **Tier 0: Types**         | types (live)                                            | types (live)                    | unchanged    |
| **Tier 2: Agent Runtime** | agent + session + token-economy                         | agentic-loop + session + tokens | rename + new |
| **Tier 3: Providers**     | providers + normalizers + adapters + tool-calls + retry | providers w/ subfolders         | 4 → 1        |
| **Tier 4: Platform**      | agents (min) + plugins (min) + connectors (min)         | agents + plugins + connectors   | expand       |
| **New MVPs**              | —                                                       | cli + tools + testing           | create       |

**Final Count: 42 → ~22-25 packages** ✓

---

## Final Package Inventory (~22-25 packages)

### **Tier 0: Core Stream Processing**

| Package   | Purpose                                                                                                                     | Source                                                                                   | Status   |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| **core**  | Stream processing bundle (LLMStreamProcessor, SSEParser, structured, thinking, tool-calls, xml-filter, context, formatting) | Merge: processor, sse, structured, thinking, tool-calls, xml-filter, context, formatting | **NEW**  |
| **types** | Shared type contracts across ecosystem                                                                                      | packages/types/                                                                          | **LIVE** |

**Core package structure:**

```text
packages/core/
├── src/
│   ├── /processor/        (from packages/processor/)
│   ├── /sse/               (from packages/sse/)
│   ├── /structured/        (from packages/structured/)
│   ├── /thinking/          (from packages/thinking/)
│   ├── /tool-calls/        (from packages/tool-calls/)
│   ├── /xml-filter/        (from packages/xml-filter/)
│   ├── /context/            (from packages/context/)
│   └── /formatting/        (from packages/formatting/)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── IMPLEMENTATION-PLAN.md
```

### **Tier 2: Agent Runtime**

| Package          | Purpose                                                            | Source                                          | Status     |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ---------- |
| **agentic-loop** | Agent loop orchestration (loops, stop conditions, approval engine) | packages/agent/ (rename)                        | **RENAME** |
| **session**      | Crash-safe session persistence, atomic writes, auto-repair         | New (implement from plan)                       | **CREATE** |
| **tokens**       | Token budgets, shaping, pacing (renamed from token-economy)        | packages/token-economy/ (rename + merge pacing) | **RENAME** |

**Session package (per plan/agentsy-tech.md §4.7):**

```text
packages/session/
├── src/
│   ├── index.ts
│   ├── SessionStore.ts          (interface: saveUser, saveAssistant, save, load, list, delete, loadAsSnapshot)
│   ├── FileSystemSessionStore.ts (implementation: atomic writes, lazy creation, cursor-based)
│   ├── StreamSnapshot.ts         (interface: sessionId, messages, stepIndex, metadata, createdAt, updatedAt)
│   └── session.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── IMPLEMENTATION-PLAN.md
```

**Tokens package (per plan/agentsy-token-economy.md + pacing-function-implementation.md):**

```text
packages/tokens/
├── src/
│   ├── index.ts
│   ├── budgets.ts            (token budgets, reduction strategies)
│   ├── shaping.ts            (output shaping)
│   ├── pacing.ts             (rate-aware execution, dead-time utilization - MERGED from pacing)
│   └── tokens.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── IMPLEMENTATION-PLAN.md
```

### **Tier 3: Provider Integration**

| Package       | Purpose                                                                              | Subfolders                                                                              | Status     |
| ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------- |
| **providers** | Provider registry, universal AI client, normalizers, adapters, manager, model-picker | /openai/, /anthropic/, /normalizers/, /adapters/, /tools/, /queue/, /manager/, /picker/ | **EXPAND** |

**Provider subfolder details:**

- `/openai/`: Universal AI client (OpenAI compatible), token budgeting endpoints
- `/anthropic/`: Universal AI client (Anthropic compatible), token budgeting endpoints
- `/normalizers/`: 16 files from packages/normalizers/ (provider-specific transformations)
- `/adapters/`: 7 files from packages/adapters/ (stream adapters)
- `/tools/`: 10 files from packages/tool-calls/ (tool-call validation)
- `/queue/`: 4 files from packages/retry/ (retry with backoff)
- `/manager/`: Provider manager module (add/remove/edit providers + API keys via secrets)
- `/picker/`: Model picker toolset (temp/top-p/top-k tuning + creativity/thinking presets)

**Provider manager (per user requirement):**

```typescript
export class ProviderManager {
  addProvider(id: string, type: ProviderType, apiKey: string, model: string): void;
  removeProvider(id: string): void;
  editProvider(id: string, updates: Partial<ProviderConfig>): void;
  getProvider(id: string): ProviderConfig | undefined;
  listProviders(): ProviderConfig[];
}
```

**Model picker (per user requirement):**

```typescript
export const CREATIVITY_PRESETS = {
  low: { temperature: 0.7, top_p: 0.8, top_k: 50 },
  medium: { temperature: 1.0, top_p: 0.9, top_k: 100 },
  high: { temperature: 1.4, top_p: 0.95, top_k: 200 },
} as const;

export const THINKING_PRESETS = {
  low: { temperature: 0.7, top_p: 0.8, top_k: 50 },
  medium: { temperature: 1.0, top_p: 0.9, top_k: 100 },
  high: { temperature: 1.4, top_p: 0.95, top_k: 200 },
} as const;
```

### **Tier 3: Agent Interop (Three Separate Layers)**

Per `plan/agentsy-subagents.md`:

| Package        | Purpose                                                                                                  | Status     |
| -------------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| **agents**     | Local orchestration: A2A protocol (Agent Cards, discovery, transport) + subagents (coordinator/worker)   | **EXPAND** |
| **plugins**    | Plugin architecture (AgentModeFactory) + example specialized agents (caveman, superpowers, garry's mode) | **EXPAND** |
| **acp**        | Agent Client Protocol: editor/client-facing session protocol                                             | **CREATE** |
| **acp-client** | ACP client transport: stdio/JSON-RPC (local), HTTP/WebSocket (remote)                                    | **CREATE** |

**NOTE:** These are three distinct layers, NOT one monolithic agent package:

- `@agentsy/agents` = local orchestration (subagents + A2A)
- `@agentsy/plugins` = plugin system + example agents
- `@agentsy/acp` + `@agentsy/acp-client` = editor/client protocol

**Agents package (per plan/agentsy-subagents.md):**

```text
packages/agents/
├── src/
│   ├── index.ts
│   ├── subagents/
│   │   ├── coordinator.ts
│   │   ├── worker.ts
│   │   ├── task-assignment.ts
│   │   ├── delegation-policy.ts
│   │   └── merge-results.ts
│   ├── a2a/
│   │   ├── agent-card.ts
│   │   ├── discovery.ts
│   │   ├── transport.ts
│   │   ├── protocol.ts
│   │   └── capability-matcher.ts
│   └── types.ts (SubagentDefinition, SubagentTask, SubagentResult, AgentCard, etc.)
├── package.json
└── IMPLEMENTATION-PLAN.md
```

**Plugins package (per plan/agentsy-agents-v1.md):**

```text
packages/plugins/
├── src/
│   ├── index.ts
│   ├── system.ts               (plugin architecture framework)
│   ├── registry.ts             (plugin manager)
│   ├── types.ts                (AgentModeFactory<TOptions, TActivator> interface)
│   ├── caveman/
│   │   ├── createCavemanManager.ts
│   │   ├── caveman-skills/      (bundled SKILL.md files)
│   │   └── _manifest.ts
│   ├── superpowers/
│   │   ├── createSuperpowersActivator.ts
│   │   ├── superpowers-skills/  (bundled SKILL.md files)
│   │   └── _manifest.ts
│   └── garrys/
│       ├── createGarrysAgent.ts
│       ├── garrys-skills/       (9 sprint SKILL.md files)
│       └── _manifest.ts
├── package.json
└── IMPLEMENTATION-PLAN.md
```

### **Tier 4: Platform Tools**

| Package        | Purpose                                                                                                            | Status     |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| **tools**      | Built-in agent utilities: web search, web fetch, code runner/REPL, MCP-as-tools                                    | **CREATE** |
| **cli**        | Component installer (shadcn-like), doctor script, documentation MCP, agent TUI (later)                             | **CREATE** |
| **testing**    | Scenario libraries, red team testing, chaos testing, mock generators                                               | **CREATE** |
| **connectors** | Third-party comms platform adapters: Signal, WhatsApp, Matrix, Telegram, IMAP/SMTP email, custom adapter interface | **EXPAND** |

**Tools package (MCP servers exposed as internal tools):**

```text
packages/tools/
├── src/
│   ├── index.ts
│   ├── builtin/
│   │   ├── web-search/
│   │   │   ├── search.ts
│   │   │   ├── provider-resolver.ts
│   │   │   └── query-builder.ts
│   │   ├── web-fetch/
│   │   │   ├── fetcher.ts
│   │   │   └── cache.ts
│   │   ├── code-runner/
│   │   │   ├── executor.ts
│   │   │   ├── sandbox.ts
│   │   │   └── language-picker.ts
│   │   └── repl/
│   │       ├── terminal.ts
│   │       ├── history.ts
│   │       └── completion.ts
│   └── mcp-internal/
│       ├── fd.ts       (MCP server as internal tool)
│       ├── fzf.ts      (MCP server as internal tool)
│       ├── charon.ts    (MCP server as internal tool)
│       ├── sd.ts        (MCP server as internal tool)
│       └── eza.ts       (MCP server as internal tool)
├── package.json
└── IMPLEMENTATION-PLAN.md
```

**CLI package (MVP):**

```text
packages/cli/
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── doctor/              (dependency + usage check)
│   │   │   ├── doctor.ts
│   │   │   ├── dependency-check.ts
│   │   │   └── usage-review.ts
│   │   ├── install/             (shadcn-like component installer)
│   │   │   ├── component-installer.ts
│   │   │   └── template-resolver.ts
│   │   ├── documentation/      (documentation MCP)
│   │   │   └── mcp.ts
│   │   └── agent/              (agent TUI - future phase)
│   │       └── tui.ts
│   └── components/             (shared Ink components for TUI)
│       ├── ink-helpers/
│       └── gui-hooks/           (for GUI builders)
├── package.json
└── IMPLEMENTATION-PLAN.md
```

**Connectors package (per plan/agentsy-connectors-v1.md):**

```text
packages/connectors/
├── src/
│   ├── index.ts
│   ├── core/
│   │   ├── ChannelAdapter.ts    (interface)
│   │   ├── MessageRouter.ts
│   │   ├── AgentSessionManager.ts
│   │   └── AdapterRegistry.ts
│   ├── signal/
│   │   └── SignalAdapter.ts
│   ├── whatsapp/
│   │   └── WhatsAppAdapter.ts
│   ├── matrix/
│   │   └── MatrixAdapter.ts
│   ├── telegram/
│   │   └── TelegramAdapter.ts
│   ├── email/
│   │   ├── IMAPAdapter.ts
│   │   └── SMTPAdapter.ts
│   └── custom/
│       └── createCustomAdapter.ts
├── package.json
└── IMPLEMENTATION-PLAN.md
```

### **Tier 6: Platform Surface (Enhance Existing)**

| Package            | Purpose                                                        | Enhancement                                          | Status        |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| **memory**         | 3-layer blended memory (raw log, wiki, vector retrieval)       | Add global/project/session scope boundaries          | **ENHANCE**   |
| **retrieval**      | Vector store + document store for RAG                          | Add document store for file dump→vectorize→retrieval | **ENHANCE**   |
| **telemetry**      | Observability (metrics, tracing, error tracking)               | Keep as-is                                           | **KEEP**      |
| **ui**             | UI layer components (shadcn/radix wrappers)                    | Keep as-is                                           | **KEEP**      |
| **vscode**         | VS Code integration (chat participant, settings, MCP bridging) | Keep as-is (extension-vscode merged here)            | **KEEP**      |
| **ag-ui**          | AG-UI protocol bridge utilities                                | Keep as-is                                           | **KEEP**      |
| **renderers**      | Text-oriented output, DisplayPort, Ink components              | Keep as-is (renderer-gui merged here)                | **KEEP**      |
| **integration**    | Cross-package integration test harness                         | Keep as-is (private)                                 | **KEEP**      |
| **slash-commands** | 12 stock commands, SKILL.md parsing                            | Implement per plan                                   | **IMPLEMENT** |
| **skills**         | SkillsManager orchestration, progressive loading               | Implement per plan                                   | **IMPLEMENT** |

**Memory package (per plan/agentsy-memory.md and plan/agentsy-tech.md §4.11):**

```text
packages/memory/
├── src/
│   ├── index.ts
│   ├── raw-event-log/
│   │   ├── RawEventLog.ts       (append-only JSONL, cursor-based reads)
│   │   └── CursorManager.ts
│   ├── wiki-store/
│   │   ├── WikiStore.ts         (entities, concepts, synthesis, sources)
│   │   └── WikiPage.ts
│   ├── retrieval/               (delegates to @agentsy/retrieval)
│   │   └── MemoryRetrieval.ts
│   ├── lifecycle/
│   │   ├── MemoryLifecycle.ts   (consolidate, synthesize, startTask, endTask)
│   │   └── MemoryLint.ts        (contradiction, freshness checks)
│   ├── scope/
│   │   ├── scope.ts             (session, user, project, team, global boundaries)
│   │   └── ScopeManager.ts
│   ├── injection/
│   │   └── MemoryInjection.ts   (build <memory_context> XML for safe injection)
│   ├── security/
│   │   └── MemorySecurity.ts    (prompt-injection detection, privacy tags, trust tiers)
│   └── MemoryEngine.ts          (top-level facade)
├── package.json
└── IMPLEMENTATION-PLAN.md
```

**Retrieval package (per plan/agentsy-tech.md §4.12):**

```text
packages/retrieval/
├── src/
│   ├── index.ts
│   ├── VectorStore.ts           (interface: insert, insertBatch, search, delete, stats)
│   ├── EmbeddingProvider.ts     (interface: embed, embedBatch)
│   ├── RetrievalEngine.ts       (indexPage, indexPages, removePage, search, fullTextSearch)
│   ├── libsql-store.ts          (local SQLite with vector extension)
│   ├── turso-store.ts           (Turso cloud backend)
│   ├── document-store.ts        (NEW: dump files → vectorize → retrieval for RAG)
│   └── createRetrievalEngine.ts
├── package.json
└── IMPLEMENTATION-PLAN.md
```

---

## Packages to Delete/Remove

| Package            | Reason                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| `context-manager/` | Duplicate of context/ → merged into core/context/                                   |
| `mcp/`             | MCP servers become tools (not standalone package) → merged into tools/mcp-internal/ |
| `repl/`            | REPL functionality → merged into cli/                                               |
| `plugins/` (old)   | Replaced by expanded plugins/ (caveman/superpowers/garry's mode)                    |
| `scheduler/`       | Not needed as separate package → pacing merged into tokens/                         |
| `secrets/`         | Not needed as separate package → merged into providers/manager/                     |
| `context-manager/` | Duplicate of context/                                                               |

**NOTE:** `acp/` (minimal scaffold) is the ACP CLIENT package, not A2A. It needs to be expanded per plan/agentsy-acp-client.md.

---

## Dependency Hierarchy

```text
Tier 6 (vscode/ui/ag-ui/renderers/integration/slash-commands/skills/memory/retrieval)
    ↓
Tier 5 (agents/subagents + a2a, plugins, acp, acp-client, connectors)
    ↓
Tier 4 (tools, cli, testing, memory, retrieval)
    ↓
Tier 3 (providers + subfolders, session, tokens)
    ↓
Tier 2 (agentic-loop, session, tokens)
    ↓
Tier 0 (core, types)
```

**Critical path:** Tier 0 → Tier 2 → Tier 3 → Tier 4 before Tier 5 can be built.
**MVP path:** Tier 0+2+3 → Tier 4 (tools, cli, testing) → Tier 5 (agents, plugins, acp)

---

## Implementation Priority

### **P0 — Core Consolidation (Blocking)**

1. Create core package (merge processor, sse, structured, thinking, tool-calls, xml-filter, context, formatting)
2. Rename agent → agentic-loop
3. Rename token-economy → tokens
4. Expand providers with subfolders (normalizers/, adapters/, tools/, queue/)
5. Create providers/manager (add/remove/edit providers + API keys)
6. Create providers/picker (model tuning + creativity/thinking presets)
7. Move formatting → core/formatting/
8. Update pnpm-workspace.yaml, turbo.json, all imports

### **P1 — Agent Runtime (MVP)**

9. Create session package (implement SessionStore, FileSystemSessionStore)
10. Create tokens package (rename + merge pacing from pacing-function-implementation.md)
11. Create acp and acp-client packages (editor/client protocol per plan/agentsy-acp-client.md)

### **P2 — Platform Tools (MVP)**

12. Create tools package (web search, code runner/REPL, MCP-as-internal-tools)
13. Create cli package (component installer, doctor, documentation MCP)
14. Create testing package (scenario libraries, mock generators)
15. Expand agents package (A2A + subagents per plan/agentsy-subagents.md)
16. Expand plugins package (caveman/superpowers/garry's mode per plan/agentsy-agents-v1.md)
17. Expand connectors package (per plan/agentsy-connectors-v1.md)

### **P3 — Platform Surface (Enhancement)**

18. Enhance memory (3-layer: raw log, wiki, vector + scope boundaries)
19. Enhance retrieval (document store for RAG + libSQL/Turso vector backend)
20. Implement slash-commands
21. Implement skills (SkillsManager, progressive loading)
22. Implement guardrails (OWASP moderation, PII scrubbing)

---

## Documentation Updates Required

1. **docs/index.md** — Update package count (42 → ~22-25)
2. **docs/architecture/package-ecosystem.md** — Update tier breakdown
3. **docs/packages.md** — Update package catalog (consolidated versions)
4. **docs/getting-started.md** — Update example imports
5. **docs/api.md** — Update API index (core subpath exports)
6. **docs/migration/** — Add migration guides for consolidated packages

---

## Verification Gates

### After Phase 0 (Core Consolidation)

- [ ] 7 separate stream packages merged to 1 core package
- [ ] Core exports work correctly via subpath exports
- [ ] No broken imports after consolidation
- [ ] All files retain original functionality (backward compatibility)

### After Phase 1 (Agent Runtime)

- [ ] session package implements SessionStore + FileSystemSessionStore
- [ ] tokens package includes pacing (merged from pacing-function-implementation.md)
- [ ] acp and acp-client packages implement editor/client protocol

### After Phase 2 (Platform Tools)

- [ ] tools package has web search, code runner, MCP-as-internal-tools
- [ ] cli package has component installer, doctor, documentation MCP
- [ ] agents package has A2A + subagents
- [ ] plugins package has caveman/superpowers/garry's mode
- [ ] connectors package has Signal/WhatsApp/Matrix/Telegram/Email adapters

### Final Verification

- [ ] All ~22-25 packages have package.json and IMPLEMENTATION-PLAN.md
- [ ] pnpm install succeeds
- [ ] Full test suite passes
- [ ] Dependency graph has no cycles
- [ ] docs/ fully updated to reflect new structure
