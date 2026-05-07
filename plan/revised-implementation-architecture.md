# Revised Implementation Architecture

## Executive Summary

**Goal:** Composable platform architecture with ~22 packages (down from 44), prioritized implementation, and clear co-development groups.

**Status:** 18 existing packages live, 4 planned packages in current scope (CLI, Universal AI Client, Provider Manager, Tools)

---

## Architecture Principles

1. **Modular by Default, Composable by Design:** Packages are independent but expose pluggable components
2. **Subpath Exports for Granularity:** Provider-specific code lives in subfolders, default exports for common use
3. **Internal vs External:** Protocol implementations are internal tools; MCP already being redesigned as internal
4. **Dependency Hierarchy:** Tier 0-2 must stabilize before Tier 3-4 can build dependencies
5. **Validation Gates:** Each phase has clear success criteria before progressing

---

## Package Inventory (22 Total)

### Tier 0: Foundation (Must stabilize first)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **types** | Core type system | JsonObject, JsonValue, interfaces, ADR contracts | Live |
| **xml-filter** | XML privacy stripping | Lexer/parser, privacy-correction | Live |
| **context** | Context window events | auto-resize, awareness updates | Live |
| **formatting** | Response formatting | Markdown, HTML, code highlighting | Live |
| **sse** | SSE parsing | Chunk parser, batch detection, notifiers | Live (merged strategy) |
| **structured** | Structured output | Schema validation, JSON/YAML via schema registry | Live |

### Tier 1: Stream Processing (Core pipeline)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **processor** | LLMStreamProcessor | Per-message state, backpressure | Live |
| **recovery** | Session recovery | Snapshot/resume, rollback | Live |
| **thinking** | Reasoning extraction | Thinking block parsing, reasoning tracking | Live |

### Tier 2: Agent Runtime (Orchestration)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **agentic-loop** | Agent loop orchestration | Approval engine, stop conditions, loop control | Agentic Loop from agent package |
| **token-economy** | Token budgets & shaping | Budgets, reduction strategies, shaping | Live (renamed from token-economy, will include pacing) |
| **session** | Session management | Branching, serialization, history | Planned |

### Tier 3: Provider Integration (Multi-model)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **mcp** | MCP integrator | Auto-install, tool discovery, internal tools | Planned |
| **providers** | Provider registry | Universal AI client, provider manager, model picker | **New - MVP** |
| **memory** | Durable knowledge store | Global/project/session dimensions, retrieval | Live |
| **retrieval** | RAG document store | Vector search + libSQL/Turbo document store | Live |

### Tier 4: Tools & Integrations (Agent utilities)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **tools** | Built-in agent tools | Web search, web fetch, file ops, git, code runner | **New - MVP** |
| **telemetry** | Observability | Metrics, tracing, error tracking | Live |
| **guardrails** | Safety moderation | OWASP moderation, PII scrubbing (REQ-076→REQ-090) | Planned |
| **testing** | Scenario + mocks | Scenario libraries, mock generators | **New - MVP** |

### Tier 5: User Experience (CLI & Display)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **cli** | Agenty CLI | Component installer (shadcn-like), doctor command, docs MCP | **New - MVP** |
| **ui** | UI layer components | shadcn/radix wrappers | Live |
| **agents** | Plugin system | Custom plugin examples (Garry's model, etc.), plugin manifest | Live (renamed focus) |

### Tier 6: Protocol Bridges (Future)

| Package | Purpose | Key Outputs | Status |
|---------|---------|-------------|--------|
| **connectors** | External bridge | WhatsApp, Matrix, Telegram, Email protocols | Planned |
| **slash-commands** | Command system | 12 stock commands, SKILL.md parsing | Live |
| **skills** | SkillsManager | Progressive loading, skill orchestration | Live |

### Future / Deferred

| Package | Purpose | Status |
|---------|---------|--------|
| **extension-vscode** | VS Code extension | Merged into vscode package (stub only pending) |
| **a2a** | Agent-to-Agent protocol | Merged into agents (after dropping agentic-loop separation) |
| **subagents** | Coordinator workers | Merged into agents (future phase) |
| **desktop** | Desktop application | No plans (deferred indefinitely) |

---

## Provider Architecture

### Current Structure (Split)
```
providers/              # Provider registry, AI client
├── index.ts           # Main exports
├── _providers/        # Provider-specific subfolders
│   ├── anthropic/
│   ├── openai/
│   └── deepseek/
├── normals/           # Copy of existing normalizers
└── adapters/          # Copy of existing adapters
```

### Provider-Specific Subfolders
```
providers/
├── _providers/
│   ├── anthropic/
│   │   ├── index.ts      # Anthropic-specific tools
│   │   ├── models.ts
│   │   └── integrations.ts
│   ├── openai/
│   │   ├── index.ts
│   │   ├── models.ts
│   │   └── integrations.ts
│   └── deepseek/
│       ├── index.ts
│       ├── models.ts
│       └── integrations.ts
├── tools/             # Shared toolset
│   ├── websearch/
│   ├── webfetch/
│   ├── fileops/
│   ├── git/
│   └── coderunner/
├── index.ts           # Main exports
└── provider-manager.ts # Provider registry, keys, model picker
```

### Default Subpath Exports (in package.json)
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./_providers/*": "./src/_providers/*/index.ts",
    "./tools/*": "./src/tools/*/index.ts",
    "./provider-manager": "./src/provider-manager.ts"
  }
}
```

---

## Universal AI Client Architecture

### Core Client
```typescript
interface UniversalAIProvider {
  chat(): ChatProvider;
  completion(): CompletionProvider;
}

interface ChatProvider {
  // Anthropic-specific token_budget support
  messages(options: ChatMessagesOptions & { token_budget?: number }): Promise<ChatResponse>;
}
```

### Provider Manager Toolset
```typescript
// src/providers/provider-manager.ts

class ProviderManager {
  addProvider(provider: string, apiKey: string): void;
  removeProvider(provider: string): void;
  editProvider(provider: string, updates: Partial<ProviderConfig>): void;

  addModel(provider: string, model: ModelConfig): void;
  removeModel(provider: string, model: string): void;

  // Model picker with preconfigured definitions
  modelsForProvider(provider: string): Model[];
  preconfigured // creativity: low|medium|high, thinking: low|medium|high
}
```

### Model Picker
```typescript
interface ModelPicker {
  // Returns models filtered by provider + creativity/thinking presets
  select(options: {
    provider: string;
    creativity: 'low' | 'medium' | 'high';
    thinking: 'low' | 'medium' | 'high';
    temperature?: number;
    top_p?: number;
    top_k?: number;
  }): Model;
}
```

---

## Tools Package

### Agent-Exposed Tools
```typescript
// src/tools/websearch/websearch.ts
export function websearch(query: string, options?: SearchOptions): Promise<SearchResults>;

// src/tools/webfetch/webfetch.ts
export function webfetch(url: string, options?: RequestOptions): Promise<FetchResult>;

// src/tools/fileops/fileops.ts
export function readFiles(patterns: string[]): Promise<FileInfo[]>;
export function writeFiles(entries: FileEntry[]): Promise<void>;

// src/tools/git/git.ts
export function gitCommit(message: string, options?: CommitOptions): Promise<GitResult>;
export function gitDiff(file?: string): Promise<string>;

// src/tools/coderunner/coderunner.ts
export function runCode(code: Code, options?: RunOptions): Promise<ExecutionResult>;
```

---

## CLI Architecture (MVP)

### CLI Package
```typescript
// src/cli/index.ts
import { install } from './commands/install.js';
import { doctor } from './commands/doctor.js';
import { docs } from './commands/docs.js';
```

### New Packages for MVP
1. **@agentsy/cli** - Main CLI app + commands
2. **@agentsy/cli-docs** - Documentation MCP server
3. **@agentsy/testing** - Scenario libraries + mock generators

### CLI Features
```bash
# Component installer (shadcn-like for agenty)
agenty add components/session
agenty add tools/websearch

# Doctor command (dependency/usage checks)
agenty doctor --all
agenty doctor --package @agentsy/providers

# Documentation MCP (for chatting with docs)
agenty docs query "How do I configure token budgets?"

# Self-hosted agenty
agenty agent --start
```

---

## Updated Dependency Graph

```mermaid
graph TD
    Tier0[<b>Tier 0: Foundation</b>] --> Tier1
    Tier1[<b>Tier 1: Stream Processing</b>] --> Tier2
    Tier2[<b>Tier 2: Agent Runtime</b>] --> Tier3
    Tier3[<b>Tier 3: Provider Integration</b>] --> Tier4
    Tier4[<b>Tier 4: Tools & Integration</b>] --> Tier5

    %% Tier 0
    types --> agentic-loop
    types --> providers
    xml-filter --> processor
    context --> agentic-loop
    formatting --> agents
    sse --> processor
    structured --> recovery

    %% Tier 1
    processor --> agentic-loop
    recovery --> session
    thinking --> agentic-loop

    %% Tier 2
    agentic-loop --> mcp

    %% Tier 3
    mcp --> tools
    providers --> memory
    memory --> retrieval

    %% Tier 4
    tools --> telemetry
    tools --> slash-commands
    slash-commands --> cli
    tools --> guardrails

    %% Tier 5
    providers --> cli
    testing --> agentic-loop
    testing --> cli

    %% External Dependencies
    providers --> vscode (optional)
```

---

## Co-Development Groups

### Group A: Provider Foundation (Same Phase)
- **packages:** providers, providers/_providers/*, tokens (renamed from token-economy)
- **Rationale:** Can't ship provider ecosystem without a solid registry + universal client
- **Trigger:** Provider manager exposed + model picker defaults
- **Lockstep with:** tokens (pacing integration), testing (mocks)

### Group B: Stream Processing (Same Phase)
- **packages:** sse, xml-filter, structured, recovery, thinking
- **Rationale:** Stream infrastructure is shared across all providers
- **Trigger:** Unified stream interface for all providers
- **Lockstep with:** parser tests (scenario libraries)

### Group C: Agent Runtime (Same Phase)
- **packages:** agentic-loop, session, mcp, tools
- **Rationale:** Agent loop needs session state + tool access
- **Trigger:** Approval engine working + tool integration completed
- **Lockstep with:** providers (token budgets during loop), testing (scenario libraries)

### Group D: Memory & Retrieval (Same Phase)
- **packages:** memory, retrieval
- **Rationale:** Durable knowledge is core to agent capabilities
- **Trigger:** 3 dimensions working + RAG document store operational
- **Lockstep with:** tokens (query reduction during memory reads)

### Group E: Protocol Bridges (Same Phase)
- **packages:** slash-commands, skills, connectors
- **Rationale:** Protocol integrations are independent but share testing patterns
- **Trigger:** All 3 packages successfully integrate with test infrastructure
- **Lockstep with:** tools (especially fileops + git for connectors)

### Group F: UX & Publishing (Same Phase)
- **packages:** ui, agents, cli
- **Rationale:** Display + plugin system + CLI expose the platform
- **Trigger:** Plugin example working + CLI doctor command complete
- **Lockstep with:** testing (scenario libraries for UI/testing)

---

## ACP Integrations

### Both Protocols in Providers
```
providers/_providers/
├── anthropic/
│   ├── acp-agent-protocol/    # Agent Communication Protocol
│   └── acp-client-protocol/   # Agent Client Protocol
├── openai/
│   ├── acp-agent-protocol/
│   └── acp-client-protocol/
└── deepseek/
    ├── acp-agent-protocol/
    └── acp-client-protocol/
```

### Polyfill Strategy
```typescript
// providers/_providers/anthropic/acp-agent-protocol.ts
export function anthropicACPAdapter(protocol: 'agent' | 'client'): TCPolyfill
```

---

## Source Plan Cross-Reference

| Package | Plan Sources | REQ Coverage |
|---------|--------------|--------------|
| **types** | agentsy-tech.md, agentsy-platform-v2.md P0 | ADR-001..ADR-009 |
| **xml-filter** | agentsy-tech.md, agentsy-platform-v2.md | XML stripping, privacy |
| **context** | agentsy-tech.md, agentsy-platform-v2.md | Context window events |
| **formatting** | agentsy-tech.md, agentsy-platform-v2.md | Response formatting |
| **sse** | agentsy-tech.md | SSE parsing (merged) |
| **structured** | agentsy-tech.md | Structured output |
| **processor** | agentsy-tech.md, agentsy-platform-v2.md | LLMStreamProcessor, state map, backpressure |
| **recovery** | agentsy-tech.md | Session recovery, snapshot/resume |
| **thinking** | agentsy-tech.md, agentsy-deep-dive-v2.md | Reasoning extraction |
| **agentic-loop** | agentsy-tech.md, agentsy-platform-v2.md P0, agentsy-deep-dive-v1.md | Agent loop, stop conditions, approval |
| **token-economy** | agentsy-utils-extraction-plan.md, PR63 | Retry, shaping |
| **session** | agentsy-tech.md, agentsy-platform-v2.md | Branching, serialization (P4) |
| **mcp** | agentsy-tech.md, agentsy-platform-v2.md | MCP orchestrator, internal tools (P7) |
| **providers** | agentsy-platform-v2.md, provider-capability-matrix.md, **NEW** universal client | P8, provider manager, model picker |
| **memory** | agentsy-memory.md, agentsy-memory-integration.md | 3 dimensions, M1-M6 |
| **retrieval** | agentsy-memory.md, agentsy-tech.md | Vector + libSQL (M4) |
| **tools** | agentsy-utils-extraction-plan.md, **NEW** code runner tools | Built-in agent tools (New) |
| **telemetry** | agentsy-tech.md | Observability (P9) |
| **guardrails** | owasp-security-testing-1.md | SQM, PII (REQ-076→REQ-090) |
| **testing** | agentsy-testing-plan.md | Scenario libraries, mocks (New) |
| **cli** | agentsy-features-v1.md, agentsy-prd-task-plan.md | CLI, docs MCP (New MVP) |
| **ui** | agentsy-tech.md | DisplayPort, shadcn wrappers |
| **agents** | agent-capabilities.md | Plugin system, custom examples (New focus) |
| **slash-commands** | agentsy-features-v1.md, agentsy-prd-task-plan.md | 12 stock commands, SKILL.md (F5) |
| **skills** | agentsy-features-v1.md, agentsy-prd-task-plan.md | SkillsManager (F5) |
| **connectors** | agentsy-connectors-v1.md, agentsy-features-v1.md | CN1-CN4, F8 |

---

## IMPLEMENTATION PLAN (Per Package)

### Phase 0: Template Setup (Week 1)

For each of the 4 new packages (providers, tools, testing, cli):

1. Create `packages/*` directory
2. Add `package.json` with:
   - `name: "@agentsy/*"`
   - `description: "..."` based on purpose
   - `exports:` with subpath patterns
   - Workspace dependencies on Tier 0-3 packages
3. Add `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
4. Create `src/index.ts` barrel
5. Create `src/IMPLEMENTATION-PLAN.md` placeholder

6. Update `pnpm-workspace.yaml` with all new packages
7. Update `turbo.json` with build/test pipeline
8. Verify `pnpm install --frozen-lockfile`

### Phase 1: Tier 0 Foundation (Weeks 2-3)

**Status:** Live packages - upgrade IMPLEMENTATION-PLAN.md

**New Packages:** None (existing)

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | types | Add ADR contracts from agentsy-platform-v2.md (REQ-001…) | TBD | W2 |
| T2 | xml-filter | Add privacy stripping rules from doc | TBD | W2 |
| T3 | context | Implement context window events from docs | TBD | W2 |
| T4 | formatting | Add markdown rendering from docs | TBD | W2 |
| T5 | sse | Add batch detection + event dispatchers | TBD | W3 |
| T6 | structured | Add schema registry + validators | TBD | W3 |

**Deliverable:** All Tier 0 packages expose stable, documented APIs

### Phase 2: Tier 1 Stream Processing (Weeks 4-5)

**Status:** Live packages - upgrade IMPLEMENTATION-PLAN.md

**New Packages:** None (existing)

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | processor | LLMStreamProcessor (state map + backpressure) | TBD | W4 |
| T2 | recovery | Snapshot/resume + rollback | TBD | W4 |
| T3 | thinking | Thinking block parsing + tracking | TBD | W5 |

**Deliverable:**
- Unified stream interface for all providers
- Session recovery with branching
- Thinking block extraction working

### Phase 3: Tier 2 Agent Runtime (Weeks 6-8)

**New Packages:**
- @agentsy/agentic-loop (from agent package)
- @agentsy/session (planned from plan)
- @agentsy/mcp (internal tools, not external servers)

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | agentic-loop | Agent loop orchestration + approval engine | TBD | W6 |
| T2 | session | Branching, serialization, history | TBD | W7 |
| T3 | mcp | Auto-install, tool discovery (internal only) | TBD | W8 |

**Deliverable:**
- Approval engine working (REQs from plan)
- Session branching operational
- MCP as internal tools (not external servers)

### Phase 4: Tier 3 Provider Integration (Weeks 9-12)

**New Packages:**
- @agentsy/providers (provider registry, manager, client)
- @agentsy/memory (3 dimensions)
- @agentsy/retrieval (vector + RAG)

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | providers | Provider registry + provider manager | TBD | W9 |
| T2 | providers | Universal AI client (OpenAI + Anthropic + extensions) | TBD | W10 |
| T3 | providers | Model picker with preset definitions | TBD | W11 |
| T4 | providers | Add provider-specific subfolders | TBD | W12 |
| T5 | memory | Global, project, session dimensions (REQ-054) | TBD | W9 |
| T6 | memory | Retrieval layer (M1-M3) | TBD | W10 |
| T7 | retrieval | Vector search + libSQL document store (M4) | TBD | W11 |
| T8 | retrieval | RAG pipeline (M5-M6) | TBD | W12 |

**Co-development Gate:** All Tier 3 packages must pass integration test with agentic-loop

### Phase 5: Tier 4 Tools & Integration (Weeks 13-15)

**New Packages:**
- @agentsy/tools (websearch, webfetch, fileops, git, coderunner)
- @agentsy/telemetry
- @agentsy/guardrails
- @agentsy/testing (scenario libraries + mocks)

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | tools | Web search, web fetch, file ops, git | TBD | W13 |
| T2 | tools | Code runner (integrated into tools) | TBD | W13 |
| T3 | telemetry | Metrics, tracing, error tracking (P9) | TBD | W14 |
| T4 | guardrails | OWASP moderation, PII scrubbing (REQ-076→REQ-090) | TBD | W14 |
| T5 | testing | Scenario libraries + mock generators | TBD | W15 |

**Co-development Gate:** All tools callable from agentic-loop

### Phase 6: Tier 5 User Experience (Weeks 16-17)

**New Packages:**
- @agentsy/cli

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | cli | Component installer (shadcn-like) | TBD | W16 |
| T2 | cli | Doctor command (dependency checks) | TBD | W16 |
| T3 | cli | Documentation MCP integration | TBD | W17 |

**Deliverable:** CLI doctor command shows all issues resolved

### Phase 7: Protocol Bridging (Weeks 18-20)

**New Packages:**
- @agentsy/slash-commands
- @agentsy/skills
- @agentsy/connectors (WhatsApp, Matrix, Telegram, Email)

**Tasks:**
| Task | Package | Description | Owner | Deadline |
|------|---------|-------------|-------|----------|
| T1 | slash-commands | 12 stock commands, SKILL.md parsing (F5) | TBD | W18 |
| T2 | skills | SkillsManager, progressive loading (F5) | TBD | W18 |
| T3 | connectors | WhatsApp/Matrix/Telegram/Email protocols (CN1-CN4, F8) | TBD | W19 |

**Co-development Gate:** All 3 packages integrate with agentic-loop

---

## Updated Summary

### Before (4
```
packages/ [44 total including planned directories]
├── types, xml-filter, context, formatting, sse, structured
├── processor, recovery, thinking
├── plugins/agent, plugins/adapters, plugins/renderers, plugins/ui
├── plugins/vscode (stub only)
└── packages/ [24 planned but not created]
    ├── session, cost-tracker, context-manager, runtime, mcp, providers
    ├── memory, retrieval, telemetry, slash-commands, skills
    ├── agents, connectors, scheduler, secrets, token-economy
    ├── pacing, testing, guardrails, fileops-mcp, subagents, a2a
    ├── extension-vscode (stub only), renderer-gui (stub only)
    └── CACHED: plan files for all
```

### After (22 total)
```
packages/ [22 total packages]
├── Tier 0 (6): types, xml-filter, context, formatting, sse, structured
├── Tier 1 (3): processor, recovery, thinking
├── Tier 2 (3): agentic-loop, token-economy, session
│   └── agentic-loop = logic from @agentsy/agents (no agent arch)
├── Tier 3 (4): mcp, providers, memory, retrieval
│   └── providers = registry + universal client + manager + model picker
│   └── tools NOT created yet (deferred to Tier 4)
│   └── assert: memory stays independent
├── Tier 4 (4): tools, telemetry, guardrails, testing
│   └── tools STUB in Tier 3 but main per-tool implementation in Tier 4
│   └── testing = scenario libraries + mocks (not in providers)
├── Tier 5 (3): ui, agents, cli
│   └── agents = plugin system (custom examples removed)
│   └── agents NOT = conceptual agent arch (moved to plugins as examples)
│   └── cli = MVP (component installer, doctor, docs MCP)
└── Tier 6 (3): slash-commands, skills, connectors
```

### Deferred/Removed

| Removed | New Home/Reason |
|---------|-----------------|
| **extension-vscode** | Merged into @agentsy/vscode |
| **renderer-gui** | Merged into @agentsy/renderers |
| **agents (arch)** | Conceptual arch removed, only plugins remain |
| **fileops-mcp** | Tool implementations moved to @agentsy/tools |
| **Desktop app** | No plans (deferred) |
| **Providers subpackages** | Providers normalizers/adapters moved into subfolders |

### Added for MVP

| New Package | Purpose |
|-------------|---------|
| **@agentsy/providers** | Provider registry + universal AI client + provider manager + model picker |
| **@agentsy/tools** | Built-in tools (websearch, webfetch, fileops, git, coderunner) |
| **@agentsy/testing** | Scenario libraries + mock generators |
| **@agentsy/cli** | Component installer, doctor command, docs MCP |

---

## What's Missing from Previous Plan

1. ✅ ACP integration (both protocols) - Added to providers
2. ✅ CLI as MVP - Added to Tier 5
3. ✅ Code runner - Moved to tools package
4. ✅ Universal AI client - Added to providers
5. ✅ Provider manager + model picker - Both in providers
6. ✅ MCP as internal tools - Clarified in Tier 3
7. ✅ Provider-specific subfolders - Introduced in providers
8. ✅ Mocks in shared testing - Added to testing package
9. ✅ Consolidated stream processing - SSE merged with xml-filter (non-provider-specific)
10. ✅ Better co-development groups - 6 groups defined

---

## Verification Checklist

Before advancing to Tier N+1:

- [ ] All Tier N packages have IMPLEMENTATION-PLAN.md
- [ ] All source plan REQ IDs are mapped to tasks
- [ ] Dependency graph has no cycles
- [ ] pnpm install --frozen-lockfile succeeds
- [ ] Tier N packages pass all integration tests with Tier N-1
- [ ] Co-development groups have clear success criteria
- [ ] CLI doctor command passes for updated packages

**Current Status:** Moving to Phase 2 (Tier 1) once user approves this architecture.