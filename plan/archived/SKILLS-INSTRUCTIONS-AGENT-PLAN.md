---
goal: Skills, instructions, agent, and hooks architecture for @agentsy
version: 1.0
date_created: 2026-05-25
last_updated: 2026-05-25
owner: plugins-maintainers
status: In progress
tags: [architecture, skills, agents, hooks, instructions, discovery]
---

# Skills, Instructions, Agent & Hooks Architecture

## 1. Introduction

This plan defines the full cross-package architecture for skills discovery, instructions discovery, agent definitions, agent mode selection, and the named hook registry. It follows the agentskills.io open standard (adopted by Anthropic, GitHub Copilot, Cursor, Gemini CLI, OpenCode, VS Code) for SKILL.md progressive disclosure and is compatible with Claude Code, GitHub Copilot, Cursor, and Gemini CLI instruction formats.

## 2. Architecture Overview

### 2.1 Three-layer system

```text
┌─────────────────────────────────────────────────────────────┐
│                    @agentsy/prompts                          │
│  Instructions Layer ── Skills Layer ── Conversation History │
│  (always injected)   (lazy activated)    (per-turn)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ consumes
┌──────────────────────▼──────────────────────────────────────┐
│                    @agentsy/plugins                          │
│  SkillDiscoverer   InstructionsDiscoverer   AgentLoader     │
│  SkillActivator    InstructionComposer      AgentRegistry   │
└──────────────────────┬──────────────────────────────────────┘
                       │ feeds
┌──────────────────────▼──────────────────────────────────────┐
│                 @agentsy/orchestrator                        │
│  HookRegistry  compileHooks  createAgentSession             │
│  MemoryPreTurnHook  MemoryPostTurnHook  SkillsHook          │
│  InstructionsHook  BudgetHook  ApprovalHook  Observability  │
└──────────────────────┬──────────────────────────────────────┘
                       │ produces
┌──────────────────────▼──────────────────────────────────────┐
│              AgentLoopOptions (canonical hooks)              │
│  beforeInit  beforeStep  prepareStep  onStep  afterStep     │
│  beforeToolCall  afterToolCall  beforeFinal  afterFinal     │
│  onAbort  onError  approveToolCalls                         │
└─────────────────────────────────────────────────────────────┘
```

**Always-injected instructions vs lazy-loaded skills:** Instructions are always injected into every session — they define agent identity, behavioral constraints, and response format. Skills are lazy-loaded via progressive disclosure — they are capabilities that may or may not be activated depending on the task. This is a fundamental architectural boundary: instructions narrow the model's behavior; skills expand its capabilities.

### 2.2 Progressive disclosure (3 stages)

1. **Discovery** — At loop startup, scan all skill roots and load only `name` + `description` from each `SKILL.md` frontmatter. Zero body tokens consumed.
2. **Activation** — When the agent determines a task matches a skill's description (via semantic matching), the full `SKILL.md` body is read into context.
3. **Execution** — The agent follows the instructions, optionally reading referenced sub-files or executing bundled scripts.

### 2.3 Instructions vs Skills vs Hooks

| Layer            | Format                                                             | Injection timing                             | Owner                   |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------- | ----------------------- |
| **Instructions** | Raw markdown files (AGENTS.md, CLAUDE.md, copilot-instructions.md) | Always injected at session init              | `@agentsy/prompts`      |
| **Skills**       | SKILL.md with YAML frontmatter                                     | Lazy-loaded per-turn via semantic activation | `@agentsy/plugins`      |
| **Hooks**        | Named callbacks registered at loop construction                    | Per lifecycle event                          | `@agentsy/orchestrator` |

### 2.4 Budget and compaction model

Instructions consume from the unconditional instruction budget (`BASELINE_TOKENS`), not from the task budget. Skills, when activated, consume from the task budget. This prevents budget dilution — instruction overhead never reduces the available capacity for task-relevant reasoning.

## 3. Discovery Roots (Canonical Precedence)

### 3.1 Skill discovery roots

```text
Priority 1 (highest): <project-root>/.agents/          ← project-scoped, version-controlled
Priority 2:           ~/.agents/                        ← user-scoped global
Priority 3:           ~/.config/agentsy/skills/         ← config-dir
Priority 4:           <xdg-data-home>/agentsy/skills/   ← XDG compliant
Priority 5 (lowest):  bundled package skills             ← shipped defaults
```

### 3.2 Instructions always-inject files

All discovered and merged; highest priority wins on conflict:

```text
<project-root>/AGENTS.md
<project-root>/CLAUDE.md
<project-root>/.github/copilot-instructions.md
<project-root>/.cursor/rules/*.md   (glob, applyTo-scoped)
~/.agentsy/instructions.md
~/.config/agentsy/instructions.md
```

### 3.3 Agent definition discovery roots

```text
<project-root>/.agents/AGENT.md
~/.agents/AGENT.md
~/.config/agentsy/agents/AGENT.md
```

## 4. Package Responsibilities

### 4.1 `@agentsy/plugins` — Discovery and metadata

- `src/skills/manifest.ts` — `SkillManifest` Zod schema (agentskills.io compatible: `name`, `description`, optional `version`, `author`, `license`)
- `src/skills/discoverer.ts` — `SkillDiscoverer`: walks roots, parses frontmatter only, builds `SkillMetadata[]` index
- `src/skills/activator.ts` — `SkillActivator`: receives `SkillMetadata[]` + turn intent, returns `ActiveSkill[]` with full body loaded
- `src/skills/hook.ts` — `createSkillsHook(discoverer, activator)`: returns `prepareStep` callback
- `src/instructions/types.ts` — `InstructionFile` type: `path`, `scope`, `alwaysInject`, `content`, `priority`, `applyTo`
- `src/instructions/discoverer.ts` — `InstructionsDiscoverer`: walks standard instruction files, returns `InstructionFile[]`
- `src/instructions/hook.ts` — `createInstructionsHook(discoverer)`: returns `beforeInit` callback
- `src/agents/definition.ts` — `AgentDefinition` Zod schema: `id`, `name`, `description`, `systemPromptTemplate`, `allowedTools`, `memoryScopes`, `orchestrationMode`, `defaultModel`, `hooks`, `source`
- `src/agents/loader.ts` — `AgentLoader`: discovers `AGENT.md` files, parses frontmatter, merges with built-ins
- `src/agents/builtins/default.ts` — Built-in agent definitions (default, research, code, plan, superagent)

### 4.2 `@agentsy/orchestrator` — Hook registry and compilation

- `src/hooks/types.ts` — `HookDefinition<E>`: `name`, `event`, `priority`, `enabled`, `handler`
- `src/hooks/registry.ts` — `HookRegistry`: register, unregister, enable, disable, getHandlersForEvent
- `src/hooks/compile.ts` — `compileHooks(registry, baseOptions)`: merges handlers into AgentLoopOptions callbacks
- `src/hooks/builtins/` — First-party hooks (memory, skills, instructions, budget, approval, observability)
- `src/session.ts` — `createAgentSession(agentDef, config)`: loads agent, builds registry, compiles hooks, returns AgentLoopHandle

### 4.3 `@agentsy/runtime` — Memory hook implementations

- `src/hooks/memory-pre-turn.ts` — `createMemoryPreTurnHook()`: retrieves memory, packs as XML segments
- `src/hooks/memory-post-turn.ts` — `createMemoryPostTurnHook()`: captures observations, classifies by memory class
- `src/hooks/wiki-memory.ts` — `createWikiMemoryHook()`: session-level wiki synthesis

### 4.4 `@agentsy/prompts` — Layer types and composition

- `src/layers/instructions.ts` — `InstructionsLayer` segment type, `InstructionsComposer`
- `src/layers/skills.ts` — `SkillsLayer` segment type for skill activation payloads

### 4.5 `@agentsy/renderers` — Agent mode picker

- `src/ink/components/agent-picker/index.tsx` — `AgentPickerComponent`: searchable list with provenance badges

### 4.6 `@agentsy/cli` — CLI commands

- `src/commands/chat.ts` — `--agent <id>` flag, `/agent <id|?>` slash command
- `src/commands/agents.ts` — `agentsy agents list`, `agentsy agents show <id>`
- `src/commands/skills.ts` — `agentsy skills list`, `agentsy skills show <name>`

## 5. Requirements

- **REQ-SIA-001**: Skills discovery must follow agentskills.io open standard (SKILL.md format with YAML frontmatter, progressive 3-stage disclosure)
- **REQ-SIA-002**: Instructions discovery must walk standard instruction file locations at loop startup and always-inject into prompt stack
- **REQ-SIA-003**: All memory layers must be wired as first-class pre-turn and post-turn hooks in the agentic loop
- **REQ-SIA-004**: A named hook registry must exist in @agentsy/orchestrator allowing first-party and user-defined hooks
- **REQ-SIA-005**: Built-in agents must be defined as first-class AgentDefinition objects: default, research, code, plan, superagent
- **REQ-SIA-006**: Users must be able to define custom agents via AGENT.md files in standard discovery roots
- **REQ-SIA-007**: An agent mode picker must be implemented as an Ink chooser component and wired into CLI startup
- **REQ-SIA-008**: The plugin architecture must implement agentskills.io SKILL.md format as its primary extension format

## 6. Key Interfaces

### 6.1 SkillManifest

```typescript
interface SkillManifest {
  name: string; // lowercase, hyphens, max 64
  description: string; // max 1024
  version?: string;
  author?: string;
  license?: string;
}
```

### 6.2 AgentDefinition

```typescript
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPromptTemplate: string;
  allowedTools: string[] | '*';
  memoryScopes: MemoryScope[];
  orchestrationMode: 'single' | 'orchestrated' | 'autonomous';
  defaultModel?: string;
  hooks: string[]; // named hook refs
  source: 'bundled' | 'user' | 'workspace';
}
```

### 6.3 HookDefinition

```typescript
interface HookDefinition<E extends keyof AgentLoopOptions> {
  name: string;
  event: E;
  priority: number; // lower = earlier
  enabled: boolean | ((ctx: HookContext) => boolean);
  handler: AgentLoopOptions[E];
}
```

### 6.4 InstructionFile

```typescript
interface InstructionFile {
  path: string;
  scope: 'project' | 'user' | 'global';
  alwaysInject: true;
  content: string;
  priority: number;
  applyTo?: string | null; // glob pattern for file-scoped instructions
}
```

## 7. Implementation Phases

### Phase 1 — Skills foundation (@agentsy/plugins)

| Task         | Description                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| TASK-SIA-001 | Define `SkillManifest` Zod schema in `src/skills/manifest.ts` matching agentskills.io spec                     |
| TASK-SIA-002 | Implement `SkillDiscoverer` in `src/skills/discoverer.ts`: walk roots, parse frontmatter, build metadata index |
| TASK-SIA-003 | Implement `SkillActivator` in `src/skills/activator.ts`: semantic matching, full body loading                  |
| TASK-SIA-004 | Export `createSkillsHook(discoverer, activator)` from `src/skills/hook.ts`                                     |

### Phase 2 — Instructions foundation (@agentsy/plugins)

| Task         | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| TASK-SIA-005 | Define `InstructionFile` type in `src/instructions/types.ts`                |
| TASK-SIA-006 | Implement `InstructionsDiscoverer` in `src/instructions/discoverer.ts`      |
| TASK-SIA-007 | Export `createInstructionsHook(discoverer)` from `src/instructions/hook.ts` |

### Phase 3 — Agent definitions (@agentsy/plugins)

| Task         | Description                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| TASK-SIA-008 | Define `AgentDefinition` Zod schema in `src/agents/definition.ts`                                          |
| TASK-SIA-009 | Implement `AgentLoader` + `AgentRegistry` in `src/agents/loader.ts`                                        |
| TASK-SIA-010 | Implement built-in agent definitions in `src/agents/builtins/` (default, research, code, plan, superagent) |

### Phase 4 — Hook registry (@agentsy/orchestrator)

| Task         | Description                                                               |
| ------------ | ------------------------------------------------------------------------- |
| TASK-SIA-011 | Define `HookDefinition` type in `src/hooks/types.ts`                      |
| TASK-SIA-012 | Implement `HookRegistry` in `src/hooks/registry.ts`                       |
| TASK-SIA-013 | Implement `compileHooks(registry, baseOptions)` in `src/hooks/compile.ts` |
| TASK-SIA-014 | Register builtin hooks in `src/hooks/builtins/`                           |
| TASK-SIA-015 | Implement `createAgentSession(agentDef, config)` in `src/session.ts`      |

### Phase 5 — Memory hooks (@agentsy/runtime)

| Task         | Description                                                               |
| ------------ | ------------------------------------------------------------------------- |
| TASK-SIA-016 | Implement `createMemoryPreTurnHook()` in `src/hooks/memory-pre-turn.ts`   |
| TASK-SIA-017 | Implement `createMemoryPostTurnHook()` in `src/hooks/memory-post-turn.ts` |
| TASK-SIA-018 | Implement `createWikiMemoryHook()` for session-level wiki synthesis       |

### Phase 6 — Prompt layer types (@agentsy/prompts)

| Task         | Description                                                            |
| ------------ | ---------------------------------------------------------------------- |
| TASK-SIA-019 | Add `InstructionsLayer` segment type to prompt layer schema            |
| TASK-SIA-020 | Implement `InstructionsComposer` in `src/layers/instructions.ts`       |
| TASK-SIA-021 | Ensure `SkillsLayer` segment type exists for skill activation payloads |

### Phase 7 — Agent mode picker (@agentsy/renderers + @agentsy/cli)

| Task         | Description                                                                               |
| ------------ | ----------------------------------------------------------------------------------------- |
| TASK-SIA-022 | Implement `AgentPickerComponent` in `packages/renderers/src/ink/components/agent-picker/` |
| TASK-SIA-023 | Add `--agent <id>` flag and `/agent <id                                                   | ?>` to CLI chat command |
| TASK-SIA-024 | Add `agentsy agents list` and `agentsy agents show <id>` commands                         |
| TASK-SIA-025 | Add `agentsy skills list` and `agentsy skills show <name>` commands                       |

## 8. Compatibility

- SKILL.md format is bidirectionally compatible with Anthropic Claude Code's SKILL.md parser
- Instruction files (AGENTS.md, CLAUDE.md, copilot-instructions.md) are compatible with GitHub Copilot, Cursor, and Gemini CLI formats
- Discovery roots intentionally overlap with Claude Code, OpenCode, Copilot, and Cursor conventions
- The `applyTo` glob pattern follows GitHub Copilot's copilot-instructions.md scoping convention

## 9. Integration Points

- `@agentsy/orchestrator` hook registry → `AgentLoopOptions` → `@agentsy/runtime` loop
- `@agentsy/plugins` → `@agentsy/orchestrator` (skills/instructions hooks injected via registry)
- `@agentsy/plugins` → `@agentsy/prompts` (discovered instructions passed to instruction composer)
- `@agentsy/orchestrator` → `@agentsy/runtime` (memory hooks registered into runtime loop)
- `@agentsy/plugins` → `@agentsy/renderers` (agent list consumed by agent picker component)
- `@agentsy/renderers` → `@agentsy/cli` (agent picker component hosted by CLI)
