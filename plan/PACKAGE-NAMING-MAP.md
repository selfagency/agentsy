# Package Naming Map

## Overview

This map defines the transformation from current state to target architecture as per the DECISION-LOG.md decisions.

## Legend

- ✅ **Renamed**: Package renamed with migration path
- 🔄 **Merged**: Package merged into target
- ➕ **Created**: New package to be created
- ❌ **Deleted**: Package to be removed
- 📁 **Reorganized**: Content reorganized within package

## Core Stream Layer (Layer 1)

| Current Name    | Target Name          | Action         | Status  | Notes                            |
| --------------- | -------------------- | -------------- | ------- | -------------------------------- |
| types           | types                | Keep           | ✅ Live | Core type system                 |
| xml-filter      | xml-filter           | Keep           | ✅ Live | XML privacy stripping            |
| context         | context              | Keep           | ✅ Live | Context window events            |
| context-manager | context              | 🔄 Merge       | ✅ Live | Merged into context (Phase C-1)  |
| formatting      | formatting           | Keep           | ✅ Live | Response formatting              |
| sse             | sse                  | Keep           | ✅ Live | SSE parsing                      |
| thinking        | thinking             | Keep           | ✅ Live | Thinking block parsing           |
| structured      | structured           | Keep           | ✅ Live | Structured output                |
| tool-calls      | core/src/tool-calls/ | 🔄 Consolidate | ✅ Live | Consolidated in core (Phase C-1) |
| processor       | processor            | Keep           | ✅ Live | LLMStreamProcessor               |
| recovery        | recovery             | Keep           | ✅ Live | Session recovery                 |

## Runtime / Loop Layer (Layer 2)

| Current Name  | Target Name             | Action          | Status     | Notes                                            |
| ------------- | ----------------------- | --------------- | ---------- | ------------------------------------------------ |
| agent         | orchestrator/src/agent/ | 🔄 Consolidated | ✅ DONE    | Agent consolidated into orchestrator (Phase C-4) |
| runtime       | runtime                 | Keep            | ⏳ PENDING | Awaits Phase D merge with orchestrator           |
| agentic-loop  | agentic-loop            | Keep            | ✅ Live    | Primary loop orchestration                       |
| session       | session                 | Keep            | ✅ Live    | Session management                               |
| token-economy | tokens                  | ✅ Renamed      | ⚠️ Planned | Migration alias during transition                |
| tokens        | tokens                  | ➕ Created      | ⚠️ Planned | New token budgeting package                      |
| pacing        | tokens                  | 🔄 Merge        | ⚠️ Planned | Merge pacing into tokens                         |

## Provider / Model Layer (Layer 3)

| Current Name | Target Name                 | Action         | Status         | Notes                                |
| ------------ | --------------------------- | -------------- | -------------- | ------------------------------------ |
| providers    | providers                   | Keep           | ✅ Live        | Provider registry                    |
| normalizers  | providers                   | 🔄 Reorganize  | ✅ Live        | Reorganized to providers (Phase C-2) |
| adapters     | providers                   | 🔄 Merge       | ✅ Live        | Merged into providers (Phase C-2)    |
| secrets      | secrets                     | Keep           | ✅ Live        | Cross-cutting infrastructure         |
| scheduler    | orchestrator/src/scheduler/ | 🔄 Move        | ⏳ IN-PROGRESS | Scheduler in orchestrator (Phase D)  |
| retry        | core/src/retry/             | 🔄 Consolidate | ✅ Live        | Consolidated in core (Phase C-1)     |

## Knowledge Layer (Layer 4)

| Current Name | Target Name | Action | Status  | Notes                   |
| ------------ | ----------- | ------ | ------- | ----------------------- |
| memory       | memory      | Keep   | ✅ Live | Durable knowledge store |
| retrieval    | retrieval   | Keep   | ✅ Live | RAG document store      |

## Tooling Layer (Layer 5)

| Current Name  | Target Name | Action        | Status     | Notes                |
| ------------- | ----------- | ------------- | ---------- | -------------------- |
| tools         | tools       | Keep          | ✅ Live    | Built-in agent tools |
| mcp           | tools       | 🔄 Reorganize | ⚠️ Planned | Internal MCP tools   |
| fileops-mcp   | tools       | 🔄 Merge      | ❌ Stale   | Internal tool set    |
| websearch-mcp | tools       | 🔄 Merge      | ❌ Stale   | Internal tool set    |
| repl          | cli         | 🔄 Merge      | ❌ Stale   | REPL is CLI feature  |
| testing       | testing     | Keep          | ✅ Live    | Scenario libraries   |
| telemetry     | telemetry   | Keep          | ✅ Live    | Observability        |
| guardrails    | guardrails  | Keep          | ✅ Live    | Safety moderation    |
| cli           | cli         | Keep          | ✅ Live    | CLI package          |

## Interop / Plugin Layer (Layer 6)

| Current Name   | Target Name    | Action     | Status     | Notes                               |
| -------------- | -------------- | ---------- | ---------- | ----------------------------------- |
| plugins        | plugins        | Keep       | ✅ Live    | Plugin system                       |
| agents         | agents         | Keep       | ✅ Live    | Agent extension system              |
| slash-commands | slash-commands | ➕ Created | ❌ Missing | Command registry + SKILL.md parsing |
| skills         | skills         | ➕ Created | ❌ Missing | SkillsManager + progressive loading |
| subagents      | subagents      | ➕ Created | ❌ Missing | Local worker orchestration          |
| a2a            | a2a            | ➕ Created | ❌ Missing | Remote agent protocol               |
| acp            | acp            | Keep       | ✅ Live    | Editor/client protocol              |
| acp-client     | acp-client     | ➕ Created | ❌ Missing | ACP client implementation           |
| connectors     | connectors     | Keep       | ✅ Live    | Third-party comms                   |

## Presentation Layer (Layer 7)

| Current Name     | Target Name | Action     | Status     | Notes                      |
| ---------------- | ----------- | ---------- | ---------- | -------------------------- |
| ui               | ui          | Keep       | ✅ Live    | UI layer components        |
| ag-ui            | ui          | 🔄 Merge   | ✅ Live    | Merged into ui (Phase C-3) |
| renderers        | renderers   | Keep       | ✅ Live    | Component library          |
| renderer-gui     | renderers   | 🔄 Merge   | ⚠️ Planned | GUI hooks into renderers   |
| vscode           | vscode      | Keep       | ✅ Live    | VS Code integration        |
| extension-vscode | vscode      | 🔄 Merge   | ⚠️ Planned | Clean composition          |
| desktop          | -           | ❌ Deleted | ❌ Stale   | No desktop app plan        |

## Consolidated Summary

### Packages to Create (6)

- tokens (renamed from token-economy)
- slash-commands
- skills
- acp-client
- subagents
- a2a

### Packages to Delete (3)

- core (empty directory)
- desktop (no plan exists)
- [merged packages will be deleted after content migration]

### Packages to Split (1)

- tool-calls → tools (schemas) + providers (provider-specific calls)

### Major Merges (6)

- context-manager → context
- runtime → agentic-loop
- pacing → tokens
- ag-ui → ui
- renderer-gui → renderers
- extension-vscode → vscode

### Reorganizations (2)

- normalizers → providers/\_Providers/\*/
- adapters → providers
- scheduler → providers
- retry → context or delete
- mcp → tools/mcp-internal

## Migration Priority

### Phase 1 (High Priority - Core foundation)

1. Delete `core` (empty)
2. Merge `context-manager` → `context`
3. Rename `agent` → `agentic-loop`
4. Merge `runtime` → `agentic-loop`
5. Rename `token-economy` → `tokens`
6. Merge `pacing` → `tokens`

### Phase 2 (Medium Priority - Provider/Tool consolidation)

1. Reorganize `normalizers` → `providers/_Providers/*/`
2. Merge `adapters` → `providers`
3. Split `tool-calls` → `tools` + `providers`
4. Reorganize `mcp` → `tools/mcp-internal`

### Phase 3 (Lower Priority - Presentation/UI)

1. Merge `ag-ui` → `ui`
2. Merge `renderer-gui` → `renderers`
3. Merge `extension-vscode` → `vscode`

### Phase 4 (New packages)

1. Create `slash-commands`
2. Create `skills`
3. Create `acp-client`
4. Create `subagents`
5. Create `a2a`

## Import Path Mapping

For each rename/merge, update imports as follows:

### token-economy → tokens

```typescript
// Old
import { TokenBudget } from '@agentsy/token-economy';
// New
import { TokenBudget } from '@agentsy/tokens';
```

### agent → agentic-loop

```typescript
// Old
import { AgentLoop } from '@agentsy/orchestrator/agent';
// New
import { AgentLoop } from '@agentsy/orchestrator/agentic-loop';
```

### tool-calls split

```typescript
// Old
import { ToolCall, ProviderToolCall } from '@agentsy/tool-calls';
// New
import { ToolCall } from '@agentsy/tools';
import { ProviderToolCall } from '@agentsy/providers';
```

## Verification Checklist

After each migration phase:

- [ ] `pnpm install --frozen-lockfile` succeeds
- [ ] `pnpm build` succeeds
- [ ] `pnpm check-types` passes
- [ ] `pnpm test` passes
- [ ] No circular dependencies
- [ ] All imports updated
- [ ] Package.json dependencies updated
- [ ] Documentation references updated
