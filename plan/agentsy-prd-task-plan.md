---
goal: 'PRD documentation set for @agentsy platform — product requirements, research notes, and technical design'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'In progress'
tags: ['prd', 'agentsy', 'documentation', 'planning']
---

# @agentsy PRD Documentation Task Plan

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

Tracks the creation of the four-file PRD documentation set for the `@agentsy` platform. The implementation plan (`agentsy-platform-v2.md`) defines the engineering execution; these PRD files define the **product requirements** (what and why), **research provenance** (where decisions come from), and **technical design** (full API surface).

## 1. Requirements & Constraints

- **REQ-001**: All four files must be consistent with `agentsy-platform-v2.md` and `agentsy-deep-dive-v1.md`.
- **REQ-002**: `prd.md` must reference specific requirements (REQ-001…REQ-024) by ID.
- **REQ-003**: `prd-notes.md` must include primary-source citations with GitHub URLs for every design decision.
- **REQ-004**: `tech.md` must include TypeScript type signatures for all public package APIs.
- **REQ-005**: All files must follow the Implementation Plan template (front matter + sections 1–8).

## 2. Implementation Steps

### Phase 1 — File Creation

- **GOAL-001**: Create all four PRD files in `plan/` directory.

| Task     | Description                                                                              | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Create `plan/agentsy-prd-task-plan.md` (this file)                                       | ✅        | 2026-05-02 |
| TASK-002 | Create `plan/agentsy-prd-notes.md` — consolidated research with primary source citations |           |            |
| TASK-003 | Create `plan/agentsy-prd.md` — product requirements document                             |           |            |
| TASK-004 | Create `plan/agentsy-tech.md` — technical design with full TypeScript API surface        |           |            |

### Phase 2 — Review and Cross-Link

- **GOAL-002**: Verify all documents are internally consistent and cross-linked.

| Task     | Description                                                                           | Completed | Date |
| -------- | ------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-005 | Verify every REQ/SEC/CON in v2 plan is reflected in `prd.md`                          |           |      |
| TASK-006 | Verify every HIGH-priority finding in synthesis doc has a tech.md implementation note |           |      |
| TASK-007 | Verify all 16 package APIs are defined in `tech.md`                                   |           |      |
| TASK-008 | Ensure `docs/architecture.md` and `docs/packages.md` are scaffolded (R2-003/004)      |           |      |

### Phase 3 — Extend Documentation for New Feature Packages

- **GOAL-003**: Document the 6 new feature packages (caveman, skills, MCP management, superpowers, slash commands, connectors) across all PRD files.

| Task        | Description                                                                                                                                             | Completed | Date       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-F5-001 | Create `packages/slash-commands/` workspace package scaffold: `package.json`, `tsconfig.json`, `src/index.ts`                                           |           |            |
| TASK-F5-002 | Implement `SlashCommandRegistry`: discover SKILL.md files, parse frontmatter, register commands, `execute(name, args)`                                  |           |            |
| TASK-F5-003 | Implement 12 stock slash commands in `packages/slash-commands/src/commands/`                                                                            |           |            |
| TASK-F5-004 | Integrate `SlashCommandRegistry` into `@agentsy/orchestrator/agent` pre-model interception hook                                                         |           |            |
| TASK-F5-005 | Add skills CLI subprocess wrapper (`@agentsy/skills`): `SkillsManager` with `find/add/list/remove/update/init`                                          |           |            |
| TASK-F5-006 | Unit tests for all 12 stock slash commands and `SkillsManager` argument validation                                                                      |           |            |
| TASK-F6-001 | Create `packages/caveman/` workspace package: bundle SKILL.md files from JuliusBrussee/caveman v1.7.0                                                   |           |            |
| TASK-F6-002 | Implement `CavemanManager`: `activate(mode)`, `deactivate()`, `isActive()`, `getSkillContent(mode)`                                                     |           |            |
| TASK-F6-003 | Implement `caveman-shrink` MCP stdio proxy: compress tool descriptions, preserve code/URL literals                                                      |           |            |
| TASK-F6-004 | Bundle `cavecrew` subagent SKILL.md variants: investigator, builder, reviewer                                                                           |           |            |
| TASK-F6-005 | Create `packages/superpowers/` workspace package: bundle obra/superpowers v5.0.7 SKILL.md files                                                         |           |            |
| TASK-F6-006 | Implement `SuperpowersActivator`: `selectSkills(context)` returning relevant skill subset                                                               |           |            |
| TASK-F6-007 | Implement context signal detection: test file presence → `tdd`, diff context → `code-review`, open-ended prompt → `brainstorming`                       |           |            |
| TASK-F6-008 | Unit tests for `CavemanManager` mode switching and `SuperpowersActivator` context signal detection                                                      |           |            |
| TASK-F6-009 | Integration test: `caveman-shrink` proxy round-trip reduces token count without altering `inputSchema`                                                  |           |            |
| TASK-F7-001 | Extend `@agentsy/mcp`: bundle `@mcpmarket/mcp-auto-install v0.2.1` as default child MCP server                                                          |           |            |
| TASK-F7-002 | Expose `mai_search`, `mai_details`, `mai_readme`, `mai_install`, `mai_remove` as agent tools with `dryRun: true` default                                |           |            |
| TASK-F7-003 | Implement SEC-012: `dryRun` enforcement — `mai_install`/`mai_remove` require `{ confirm: true }` for mutation                                           |           |            |
| TASK-F7-004 | Integration test: MCP auto-install dry-run returns plan; confirm=false blocks config write                                                              |           |            |
| TASK-F8-001 | Create `packages/connectors/` workspace package scaffold with `ChannelAdapter` interface and `ConnectorGateway`                                         |           |            |
| TASK-F8-002 | Implement `MessageRouter`: route inbound messages by channel ID to `AgentSessionManager`                                                                |           |            |
| TASK-F8-003 | Implement `AgentSessionManager`: per-conversation session lifecycle, `@agentsy/session` integration                                                     |           |            |
| TASK-F8-004 | Implement `TelegramAdapter` (grammy@^1 peerDep): receive/send messages, attachment handling                                                             |           |            |
| TASK-F8-005 | Implement `DiscordAdapter` (discord.js@^14 peerDep): receive/send, slash command passthrough                                                            |           |            |
| TASK-F8-006 | Implement `SlackAdapter` (@slack/bolt@^4 peerDep): receive/send, interactive message support                                                            |           |            |
| TASK-F8-007 | Apply SEC-013: sanitize inbound messages via `stripXmlContextTags` / `dedupeXmlContext` before agent injection                                          |           |            |
| TASK-F8-008 | Implement built-in connector chat commands: `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage`                                     |           |            |
| TASK-F8-009 | Unit tests for `MessageRouter`, `AgentSessionManager`, and each adapter stub                                                                            |           |            |
| TASK-F8-010 | Integration test: inbound message sanitization rejects XML injection payloads                                                                           |           |            |
| TASK-F8-011 | Integration test: `AgentSessionManager` session persistence and crash-resume via `@agentsy/session`                                                     |           |            |
| TASK-F8-012 | Integration test: connector approval flow — destructive tool calls require `auto` approval mode                                                         |           |            |
| TASK-F9-001 | Add `@agentsy/caveman`, `@agentsy/skills`, `@agentsy/superpowers`, `@agentsy/slash-commands`, `@agentsy/connectors` to `turbo.json` build/test pipeline |           |            |
| TASK-F9-002 | Add all 5 packages to `pnpm-workspace.yaml` and wire inter-package `workspace:*` deps                                                                   |           |            |
| TASK-F9-003 | Update `plan/agentsy-platform-v2.md` §1 and §8 with REQ-025..REQ-042 and new dep graph entries                                                          | ✅        | 2026-05-03 |
| TASK-F9-004 | Update `plan/agentsy-prd.md` §4 (UP-6, UP-7) and §5 (REQ-025..REQ-042 rows)                                                                             | ✅        | 2026-05-03 |
| TASK-F9-005 | Update `plan/agentsy-prd-notes.md` §2 (ADR-019..ADR-025)                                                                                                | ✅        | 2026-05-03 |
| TASK-F9-006 | Update `plan/agentsy-tech.md` with TypeScript API surface for all 5 new packages                                                                        |           |            |

## 3. Files

- **FILE-001**: `plan/agentsy-prd-task-plan.md` — this file
- **FILE-002**: `plan/agentsy-prd-notes.md` — research consolidation
- **FILE-003**: `plan/agentsy-prd.md` — product requirements
- **FILE-004**: `plan/agentsy-tech.md` — technical design
- **FILE-005**: `plan/agentsy-platform-v2.md` — source of truth for implementation tasks
- **FILE-006**: `plan/agentsy-deep-dive-v1.md` — source of truth for research findings

## 4. Related Specifications / Further Reading

- [agentsy-platform-v2.md](./agentsy-platform-v2.md) — master implementation plan
- [agentsy-deep-dive-v1.md](./agentsy-deep-dive-v1.md) — research synthesis from 9 reference codebases
