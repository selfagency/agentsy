---
goal: Gap remediation for all packages with drifted requirements
version: 1.0
date_created: 2026-05-25
last_updated: 2026-05-25
owner: agentsy-core
status: Draft
tags: [remediation, gap-analysis, packaging, dogfood, skills-plan]
---

# @agentsy Gap Remediation Plan

## 1. What This Plan Is

A complete inventory of all work required to fill gaps between what was built
vs what is now required by DOGFOOD-PLAN.md (v2.1, 2026-05-24) +
SKILLS-INSTRUCTIONS-AGENT-PLAN.md (v1.0, 2026-05-25) across every package
that had drifted requirements.

## 2. Source Documents (Authoritative)

| Document                                       | Date       | Coverage                                                                      |
| ---------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `DOGFOOD-PLAN.md`                              | 2026-05-24 | 12 phases, 95+ tasks across all packages                                      |
| `SKILLS-INSTRUCTIONS-AGENT-PLAN.md`            | 2026-05-25 | 25+ tasks across 7 phases (plugins→cli)                                       |
| `MASTER-IMPLEMENTATION-PLAN.md`                | 2026-05-15 | Canonical boundaries, compliance audit (superseded by DOGFOOD for sequencing) |
| `archived/IMPLEMENTATION-COMPLIANCE-MATRIX.md` | 2026-05-17 | FINAL audit of 10 primary packages                                            |
| `archived/BIDIRECTIONAL-GAP-ANALYSIS.md`       | 2026-05-17 | 120+ missing tasks identified                                                 |

## 3. Package Gap Inventory

Three severity classes:

- **🟢 IN-SYNC** — Package matches all known requirements. No remediation needed.
- **🟡 PLAN-STALE** — Code is good or near-good but IMPLEMENTATION-PLAN.md is outdated.
- **🔴 GAP-EXISTS** — Real code gaps vs current requirements.

### 3.1 🟢 IN-SYNC Packages (No Work Required)

| Package                  | Evidence                                                                      | Current State                                               |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `@agentsy/memory`        | 98% compliance (compliance matrix), dedicated plan phases                     | Stable, production-ready                                    |
| `@agentsy/runtime`       | 200%+ plan coverage, 32+ files                                                | Execution loop, sandbox, AG-UI, approval engine all present |
| `@agentsy/session`       | 60% compliance — entity detection beyond plan                                 | State store and manager exist, no plan changes needed       |
| `@agentsy/tokens`        | 10% but no plan changes — compression done, cost tracking deferred to Phase 4 | Matches DOGFOOD sequencing                                  |
| `@agentsy/tools`         | 15% but scaffold matches DOGFOOD Phase 5 schedule                             | Tools implementation correctly deferred                     |
| `@agentsy/secrets`       | 8% but scaffold matches DOGFOOD Phase 4 schedule                              | Secrets correctly deferred                                  |
| `@agentsy/guardrails`    | 12% but scaffold matches DOGFOOD Phase 5+11 schedule                          | Guardrails correctly deferred                               |
| `@agentsy/observability` | 30% but scaffold matches DOGFOOD Phase 5+9 schedule                           | Observability correctly deferred                            |
| `@agentsy/models`        | No recent plan changes                                                        | Stable, matches DOGFOOD Phase 3                             |
| `@agentsy/connectors`    | Plan-only domain                                                              | Correctly deferred to Phase 10                              |
| `@agentsy/mcp`           | Plan-only domain                                                              | Correctly deferred to Phase 10                              |
| `@agentsy/retrieval`     | Plan-only domain                                                              | Correctly deferred to Phase 8                               |
| `@agentsy/vscode`        | Published package                                                             | Out of DOGFOOD scope until Phase 12                         |

### 3.2 🟡 PLAN-STALE Packages (Plan Update Only)

| Package              | Issue                                                                                                                                              | Fix                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `@agentsy/types`     | TASK-067 completed (17 modules audited, +7 TSDoc, duplicate export removed, typo fixed) but IMPLEMENTATION-PLAN.md still shows TASK-067 as pending | Mark TASK-067 ✅, add verification date |
| `@agentsy/providers` | Plan doesn't reflect TASK-008 (wire provider path) or Phase 3.5 LLM Gateway integration                                                            | Add TASK-008, TASK-LB-001-020 to plan   |

### 3.3 🔴 GAP-EXISTS Packages (Code + Plan Changes)

| #   | Package                     | Gap Summary                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`@agentsy/plugins`**      | TASK-091 done (AgentManifest + registry), but missing 15 SKILLS tasks (SkillDiscoverer, InstructionsDiscoverer, AgentLoader, AgentRegistry, builtins) + DOGFOOD Phase 4 slash commands + plugin security + SKILL.md discovery                                                                               |
| 2   | **`@agentsy/orchestrator`** | 0% compliance on TASK-ORCH-001-013. Missing 8+ SKILLS tasks: HookRegistry, compileHooks, builtin hooks, createAgentSession. Missing DOGFOOD Phase 4: orchestrator integration, /mode command                                                                                                                |
| 3   | **`@agentsy/prompts`**      | Missing InstructionsLayer + SkillsLayer segment types + InstructionsComposer (TASK-SIA-019-021 = SKILLS Phase 6). Missing DOGFOOD Phase 4 TASK-064 (prompt policy stack)                                                                                                                                    |
| 4   | **`@agentsy/renderers`**    | Missing DOGFOOD Phase 2: TASK-072 (Ink chat components), TASK-073 (stream-event components), TASK-089 (acid ANSI BBS visual system), TASK-085 (model picker), TASK-011 (renderer bridge for CLI). Missing SKILLS TASK-SIA-013 (AgentPickerComponent)                                                        |
| 5   | **`@agentsy/core`**         | Missing DOGFOOD Phase 2 TASK-009 (stream normalization through core into runtime events). Missing 12 TASK-CORE-001-012 (contract freezing, compile-time snapshots, docs)                                                                                                                                    |
| 6   | **`@agentsy/cli`**          | Chat command built (readline) but missing: TASK-007 (tui/ input state manager), TASK-012 (E2E test), TASK-095 (MSW), TASK-015 (slash commands), SKILLS TASK-SIA-014 (agent/skills commands, --agent flag, /agent). Phase 4: agent mode picker, bundled superagent. Gap analysis: 18+ TASK-CLI tasks missing |

## 4. Remediation Phases

### Phase R1: Plan Updates (Read-Only, ~1 hour)

1. **`packages/types/IMPLEMENTATION-PLAN.md`** — Mark TASK-067 ✅ completed 2026-05-25. List changes: 17 modules audited, 0 strict-mode violations, +7 TSDoc annotations, duplicate export removed from index.ts, typo fixed in memory.ts.

2. **`packages/providers/IMPLEMENTATION-PLAN.md`** — Add Phase 2 section with TASK-008 (wire provider request path including OpenAI-compatible + mock provider). Add Phase 3.5 section referencing LLM-GATEWAY-PLAN.md and TASK-LB-001-020.

3. **`packages/core/IMPLEMENTATION-PLAN.md`** — Add Phase 2 section with TASK-009 (stream normalization through adapters/normalizers/processor into runtime events). Add TASK-CORE-001-012 items as Phase 2/3 backlog.

4. **`packages/renderers/IMPLEMENTATION-PLAN.md`** — Add Phase 2 section with TASK-072/073/089/085/011 (Ink components + CLI bridge). Add SKILLS Phase 7 section with TASK-SIA-013 (AgentPickerComponent).

5. **`packages/cli/IMPLEMENTATION-PLAN.md`** — Recategorize chat work as TASK-007 partial. Add TASK-012 (E2E test), TASK-095 (MSW bootstrap), TASK-SIA-014 (agent/skills commands). Add Phase 4 tasks: TASK-015 (slash commands), TASK-092 (bundled superagent), TASK-093 (agent mode picker).

6. **`packages/plugins/IMPLEMENTATION-PLAN.md`** — Add TASK-091 ✅ completed 2026-05-25 (AgentManifest + registry + 3 built-in manifests). Add SKILLS Phase 1-4 tasks (TASK-SIA-001-010). Add DOGFOOD Phase 4 tasks (TASK-015, 092, 093, TASK-PLUGIN-020-022, TASK-SKILL-015-017).

7. **`packages/orchestrator/IMPLEMENTATION-PLAN.md`** — Add SKILLS Phase 4 tasks (TASK-SIA-007-010, TASK-HOOK-001-004). Add DOGFOOD Phase 4 tasks (TASK-061, TASK-062).

8. **`packages/prompts/IMPLEMENTATION-PLAN.md`** — Add SKILLS Phase 6 tasks (TASK-SIA-012 = 019-021). Add DOGFOOD Phase 4 TASK-064.

### Phase R2: Immediate Code Gaps (DOGFOOD Phase 2 Vertical Slice)

This is the canonical DOGFOOD Phase 2 sequence — the first shippable TUI chat:

```text
renderers Ink TUI  →  providers wire path  →  core stream norm
  →  runtime turn loop  →  renderers CLI bridge  →  CLI E2E + MSW
```

#### Step 1: Ink TUI Components in renderers

**Location:** `packages/renderers/src/ink/components/`

**TASK-089 — Acid ANSI BBS Visual System**

- Create `packages/renderers/src/ink/theme/` with:
  - `palette.ts` — Semantic ANSI palette tokens (cyan=assistant, green=success, yellow=warning, red=error, dim=secondary, bright=emphasis)
  - `frames.ts` — Chromed frame primitives (box, border, separator, title bar)
  - `ascii.ts` — ASCII banner support (rendered text banners)
  - `motion.ts` — Reduced-motion fallbacks, accessibility-safe animation rules
- Tokens consumed by all Ink components

**TASK-072 — Ink Chat/Dialog Components**

- Create `packages/renderers/src/ink/components/chat/`:
  - `transcript.tsx` — Scrollable transcript with alternating user/assistant turns
  - `message-bubble.tsx` — Individual message bubble (user right-aligned, assistant left-aligned with ANSI accent)
  - `streaming-cursor.tsx` — Animated cursor during streaming response
  - `token-meter.tsx` — Live token count display (input/output/total)
  - `status-footer.tsx` — Connection status, model name, elapsed time
- Each component: pure Ink functional component, uses theme palette, keyboard-navigable

**TASK-073 — Ink Stream-Event Components**

- Create `packages/renderers/src/ink/components/stream-events/`:
  - `model-delta.tsx` — Inline model response delta rendering
  - `thinking-block.tsx` — Expandable/collapsible thinking block (dim ANSI, togglable)
  - `tool-lifecycle.tsx` — Tool call → execution → result with status indicators
  - `approval-state.tsx` — Pending/approved/rejected state with countdown
- Components receive `StreamChunk` events and render progressively

**TASK-085 — Ink Provider/Model Chooser**

- Create `packages/renderers/src/ink/components/model-picker/`:
  - `search-input.tsx` — Search field with inline results
  - `provider-list.tsx` — Filterable provider list with capability badges
  - `model-select.tsx` — Model selection with capability details
  - `scope-toggle.tsx` — Local/cloud scope switch

**TASK-SIA-013 — AgentPickerComponent** (SKILLS Phase 7)

- Create `packages/renderers/src/ink/components/agent-picker/`:
  - `index.tsx` — Searchable agent list with provenance badges (bundled/user/workspace)
  - Arrow-key navigation, model preference display, tool access summary

#### Step 2: Wire Provider Path in providers

**Location:** `packages/providers/src/`

**TASK-008 — Provider Request Path**

- Create `packages/providers/src/request-path.ts`:
  - `createRequestHandler(providers, model?)` — Returns handler that selects provider, builds request, calls `complete()` or `stream()`
  - Request builder: takes `CompletionRequest`, maps to provider-native format via existing normalizers
  - Response parser: takes raw provider response, returns unified `CompletionResponse`
- Mock provider already exists in `packages/cli/src/providers/mock.ts`

#### Step 3: Stream Normalization in core

**Location:** `packages/core/src/`

**TASK-009 — Stream Normalization → Runtime Events**

- Create `packages/core/src/stream-to-events.ts`:
  - `createStreamEventAdapter()` — Takes `ReadableStream<NormalizedChunk>`, emits typed runtime events
  - Event types: `text-delta`, `thinking-delta`, `tool-call-start`, `tool-call-end`, `error`, `done`
  - Each event carries: `chunkIndex`, `timestamp`, `payload`

#### Step 4: Runtime Turn Loop

**Location:** `packages/runtime/src/loop/`

**TASK-010 — Text-Only Turn Execution**

- Create `packages/runtime/src/loop/simple-turn.ts`:
  - `createSimpleTurnLoop(options)` — Single turn: accept message → call provider → stream response → return
  - Receives `RequestHandler` from TASK-008, `StreamEventAdapter` from TASK-009
  - Supports `onText`, `onThinking`, `onToolCall`, `onDone` callbacks
  - No tool execution yet (Phase 2 constraint)

#### Step 5: Renderer Bridge for CLI

**Location:** `packages/renderers/src/adapters/`

**TASK-011 — CLI Renderer Bridge**

- Create `packages/renderers/src/adapters/cli-bridge.ts`:
  - `createCliStreamBridge()` — Takes stream events, renders via Ink components
  - `renderStreamToInk(events, options)` — Maps stream events to Ink component props
  - `createInkSessionRenderer()` — Full-session renderer with transcript + status

#### Step 6: CLI Integration + Tests

**Location:** `packages/cli/src/`

**TASK-007 — Interactive Shell Loop (Complete)**

- Existing chat.ts is readline-based. Add input state manager:
  - `packages/cli/src/tui/input-state.ts` — Prompt history, mode display, input buffer
  - Wire Ink components when terminal supports it, fall back to readline

**TASK-012 — E2E Streaming Test**

- Create `packages/cli/src/e2e/chat-streaming.e2e.test.ts`:
  - Mock provider → request path → stream events → renderer bridge → CLI output
  - Validate: streaming content appears, thinking blocks render, token meter updates, done state reached

**TASK-095 — MSW Bootstrap**

- Create `packages/testing/src/msw/`:
  - `handlers.ts` — Reusable HTTP handlers for provider API mocks
  - `server.ts` — MSW server setup with `setupServer()`
  - `fixtures/` — Provider response fixtures

### Phase R3: DOGFOOD Phase 4 (Orchestration + Skills + Agents)

After Phase 2 vertical slice is shipping, integrate the SKILLS plan:

#### plugins → SkillDiscovery + Instructions + AgentLoader

**`packages/plugins/src/skills/`:**

- `manifest.ts` — `SkillManifest` Zod schema (agentskills.io: name, description, version?, author?, license?)
- `discoverer.ts` — `SkillDiscoverer`: walk 5 roots, parse frontmatter only, build metadata index
- `activator.ts` — `SkillActivator`: receive metadata + turn intent, return active skills with full body
- `hook.ts` — `createSkillsHook(discoverer, activator)`: returns `prepareStep` callback

**`packages/plugins/src/instructions/`:**

- `types.ts` — `InstructionFile` type (path, scope, alwaysInject, content, priority, applyTo?)
- `discoverer.ts` — `InstructionsDiscoverer`: walk 7 standard files, return `InstructionFile[]`
- `hook.ts` — `createInstructionsHook(discoverer)`: returns `beforeInit` callback

**`packages/plugins/src/agents/`:**

- `definition.ts` — `AgentDefinition` Zod schema (id, name, description, systemPromptTemplate, allowedTools, memoryScopes, orchestrationMode, defaultModel, hooks, source)
- `loader.ts` — `AgentLoader` + `AgentRegistry`: discover AGENT.md files, merge with built-ins
- `builtins/default.ts` — 5 built-in agents: default, research, code, plan, superagent

#### orchestrator → HookRegistry + compileHooks + createAgentSession

**`packages/orchestrator/src/hooks/`:**

- `types.ts` — `HookDefinition<E>`: name, event, priority, enabled, handler (8 event types)
- `registry.ts` — `HookRegistry`: register, unregister, enable, disable, getHandlersForEvent
- `compile.ts` — `compileHooks(registry, baseOptions)`: merge handlers into AgentLoopOptions
- `builtins/` — First-party hooks: memory-pre-turn, memory-post-turn, skills, instructions, budget, approval, observability
- `session.ts` — `createAgentSession(agentDef, config)`: loads agent, builds registry, compiles hooks, returns handle

#### runtime → Memory Hook Implementations

**`packages/runtime/src/hooks/`:**

- `memory-pre-turn.ts` — `createMemoryPreTurnHook()`: retrieve memory, pack as XML segments
- `memory-post-turn.ts` — `createMemoryPostTurnHook()`: capture observations, classify by memory class
- `wiki-memory.ts` — `createWikiMemoryHook()`: session-level wiki synthesis

#### prompts → InstructionsLayer + SkillsLayer + InstructionsComposer

**`packages/prompts/src/layers/`:**

- `instructions.ts` — `InstructionsLayer` segment type, `InstructionsComposer` for deterministic assembly
- `skills.ts` — `SkillsLayer` segment type for skill activation payloads

#### cli → Agent/Skills CLI Commands

**`packages/cli/src/`:**

- `commands/chat.ts` — Add `--agent <id>` flag, `/agent <id|?>` slash command
- `commands/agents.ts` — `agentsy agents list`, `agentsy agents show <id>`
- `commands/skills.ts` — `agentsy skills list`, `agentsy skills show <name>`

#### renderers → AgentPickerComponent

- Already listed in Phase R2 Step 1 (TASK-SIA-013)

## 5. Remediation Sequence & Dependencies

```text
Phase R1 (Plan updates) — No code, read-only
  │
  ▼
Phase R2 Step 1 (Ink TUI) ────────────────────┐
Phase R2 Step 2 (providers wire path) ────────┤
Phase R2 Step 3 (core stream events) ─────────┤
  │                                            │
Phase R2 Step 4 (runtime turn loop) ←─────────┘
  │
Phase R2 Step 5 (renderers CLI bridge) ←──────┘
  │
Phase R2 Step 6 (CLI integration + E2E + MSW) ←┘
  │
  ▼
Phase R3 (DOGFOOD Phase 4 = SKILLS integration)
  │
  ▼
Continue to DOGFOOD Phase 3, 3.5, 5, etc.
```

## 6. Estimating

| Phase      | Scope                              | Est. Files   | Est. Tests | Est. Effort |
| ---------- | ---------------------------------- | ------------ | ---------- | ----------- |
| R1         | Plan updates (8 files)             | 8 plan files | N/A        | ~1 hour     |
| R2 Step 1  | Ink TUI components                 | 12-15 source | 8-10 test  | ~4 hours    |
| R2 Step 2  | Provider request path              | 3-4 source   | 4-5 test   | ~1 hour     |
| R2 Step 3  | Stream normalization               | 2-3 source   | 3-4 test   | ~1 hour     |
| R2 Step 4  | Runtime turn loop                  | 3-4 source   | 4-5 test   | ~1.5 hours  |
| R2 Step 5  | CLI renderer bridge                | 2-3 source   | 3-4 test   | ~1 hour     |
| R2 Step 6  | CLI integration + E2E + MSW        | 8-10 source  | 5-6 test   | ~2.5 hours  |
| R3 Phase A | plugins skills/instructions/agents | 10-12 source | 12-15 test | ~4 hours    |
| R3 Phase B | orchestrator hooks                 | 8-10 source  | 10-12 test | ~3 hours    |
| R3 Phase C | runtime memory hooks               | 3-4 source   | 4-5 test   | ~1.5 hours  |
| R3 Phase D | prompts layers                     | 3-4 source   | 4-5 test   | ~1.5 hours  |
| R3 Phase E | CLI agent/skills commands          | 4-5 source   | 5-6 test   | ~2 hours    |

**Total estimated: ~24 hours of implementation work**

## 7. Acceptance Criteria

- [ ] All 8 package IMPLEMENTATION-PLAN.md files updated to match current requirements
- [ ] `pnpm check-types` passes monorepo-wide
- [ ] `pnpm test` passes monorepo-wide
- [ ] `pnpm --filter @agentsy/renderers test` — Ink component tests pass
- [ ] `pnpm --filter @agentsy/providers test` — provider path tests pass
- [ ] `pnpm --filter @agentsy/core test` — stream normalization tests pass
- [ ] `pnpm --filter @agentsy/runtime test` — turn loop tests pass
- [ ] `pnpm --filter @agentsy/cli test` — E2E streaming test + MSW tests pass
- [ ] `pnpm --filter @agentsy/plugins test` — skill/instruction/agent tests pass
- [ ] `pnpm --filter @agentsy/orchestrator test` — hook registry tests pass
- [ ] `pnpm --filter @agentsy/prompts test` — layer/composer tests pass
- [ ] `pnpm build` passes
- [ ] DOGFOOD-PLAN.md Phase 2 tasks all marked ✅
- [ ] SKILLS-INSTRUCTIONS-AGENT-PLAN.md tasks all marked ✅
