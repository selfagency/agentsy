---
goal: @agentsy/mcp production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: mcp-maintainers
status: In progress
tags: [feature, architecture, mcp, protocol, tools]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/mcp` as the protocol bridge for external tool/resource/prompt servers.

## 1. Requirements & Constraints

- **REQ-MCP-001**: MCP client/server integrations support stdio and HTTP/SSE transport lifecycles.
- **REQ-MCP-002**: Capability negotiation and descriptor normalization are deterministic and cacheable.
- **REQ-MCP-003**: Runtime/CLI/VS Code consumers share canonical MCP management APIs.
- **REQ-MCP-004**: Connection health/restart/timeouts are configurable and observable.
- **SEC-MCP-001**: Inbound MCP payloads are validated/sanitized at boundary ingress.
- **SEC-MCP-002**: Stdio process spawning uses literal args and no shell interpolation.
- **CON-MCP-001**: MCP protocol handling stays in this package, not duplicated in tools/runtime.
- **CON-MCP-002**: Renderers consume duck-typed outputs, not direct runtime/editor dependencies.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-MCP-001: Contract stabilization.

| Task         | Description                                                                    | Completed | Date |
| ------------ | ------------------------------------------------------------------------------ | --------- | ---- |
| TASK-MCP-001 | Stabilize tool/resource/prompt descriptor contracts and capability map schema. |           |      |
| TASK-MCP-002 | Finalize transport abstraction boundaries for stdio and network channels.      |           |      |
| TASK-MCP-003 | Document ownership boundaries and security posture.                            |           |      |

### Implementation Phase 2

- GOAL-MCP-002: Core protocol implementation.

| Task         | Description                                                        | Completed | Date |
| ------------ | ------------------------------------------------------------------ | --------- | ---- |
| TASK-MCP-004 | Complete transport client/server lifecycle and reconnection logic. |           |      |
| TASK-MCP-005 | Implement capability negotiation caching and invalidation policy.  |           |      |
| TASK-MCP-006 | Add normalized adapter outputs for runtime/tool integration.       |           |      |

### Implementation Phase 3

- GOAL-MCP-003: Integration and management flows.

| Task         | Description                                                                  | Completed | Date |
| ------------ | ---------------------------------------------------------------------------- | --------- | ---- |
| TASK-MCP-007 | Integrate runtime tool invocation and prompt/resource consumption paths.     |           |      |
| TASK-MCP-008 | Add CLI/VS Code management/test flows for server add/remove/check lifecycle. |           |      |
| TASK-MCP-009 | Emit observable MCP lifecycle events with redaction defaults.                |           |      |

### Implementation Phase 4

- GOAL-MCP-004: Hardening and release gates.

| Task         | Description                                                        | Completed | Date |
| ------------ | ------------------------------------------------------------------ | --------- | ---- |
| TASK-MCP-010 | Add transport failure-mode and protocol compatibility regressions. |           |      |
| TASK-MCP-011 | Update docs/examples for operational MCP usage.                    |           |      |
| TASK-MCP-012 | Pass package and monorepo release gates.                           |           |      |

## 3. Acceptance Criteria

- **ACC-MCP-001**: Protocol and transport contracts are stable and test-covered.
- **ACC-MCP-002**: Runtime and surface integrations are validated end-to-end.
- **ACC-MCP-003**: Security and release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `packages/mcp/README.md`
- `packages/mcp/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/mcp — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/mcp` is the **standardization bridge** of the framework. It implements the Model Context Protocol (MCP), allowing Agentsy agents to consume tools, resources, and prompts from any compatible MCP server. It handles the low-level transport, capability negotiation, and lifecycle management of these servers.

It is consumed by `@agentsy/runtime` (for tool execution) and integrates with `@agentsy/vscode` and `@agentsy/cli` for local server management.

### Ecosystem Sketch

```text
[ @agentsy/runtime ] <--- Tool Invocation
         |
         v
[ @agentsy/mcp ] <--- Protocol Orchestration
         |
    +----+----+
    |         |
    v         v
[ Stdio ] [ SSE / HTTP ] <--- Transports
    |         |
    +----+----+
         |
         v
[ MCP Servers ] (Filesystem, Postgres, GitHub, etc.)
```

## Fulfillment of Role

The package fulfills its role by providing:

1. **MCP Orchestrator**: A central manager for multiple active MCP server connections.
2. **Standardized Transports**: Robust implementations of Stdio and SSE/HTTP transports.
3. **Capability Negotiation**: Intelligent handling of what a server can provide (Tools, Resources, Prompts).
4. **Auto-Install System**: Bundled `@mcpmarket/mcp-auto-install` for dynamic tool discovery and setup.

## Detailed Functionality

### 1. Transport Layer (`src/transport/`)

- **Mechanism**: Implementations of the MCP 2025-06-18 spec.
- **Stdio**: Managing subprocesses with robust stdin/stdout piping.
- **SSE/HTTP**: Connecting to remote MCP servers over network protocols.

Target MCP protocol version 2025-06-18 (Streamable HTTP transport), which deprecates the earlier 2025-03-26 stdio-only transport. Streamable HTTP enables MCP servers to operate as long-lived HTTP endpoints with SSE push for tool result streaming.

### 2. Orchestrator (`src/orchestrator/`)

- **Responsibility**: Lifecycle and trust.
- **Functionality**:
  - `start/stop/restart`: Managing server processes.
  - `trust-level filtering`: Categorizing servers as `trusted`, `untrusted`, or `readonly`.
  - `mai_install`: Exposing the auto-install tools to the agent.

### 3. Client Implementation (`src/client/`)

- **Responsibility**: Protocol compliance.
- **Key Logic**: Handling the JSON-RPC request/response cycle, version matching, and error mapping.

### 4. Companion protocol bridges

`@agentsy/mcp` should remain MCP-first, but it can expose small bridge layers for nearby standards when the host application needs them:

- **ACP**: preserve an editor/client-friendly remote-agent surface with typed request/response envelopes.
- **A2A**: hand off capabilities, session identity, and task state when another agent must continue the work.
- **Skills Protocol**: treat skill discovery as a separate concern from server lifecycle so compact skill manifests can be loaded on demand.
- **Ratify**: carry trust metadata and delegation evidence alongside server trust levels when a consumer needs cryptographic receipts.

These bridges should stay adapter-only. The actual protocol or skill logic should continue to live in the owning package.

### 5. CLI-as-MCP-server

Package-private CLI tooling exposes agentsy itself as an MCP server (stdin/stdout transport for local use). This allows any MCP host (VS Code, Claude Desktop, Cursor) to discover and invoke agentsy tools, skills, and session management directly.

## Logic & Data Flow

### 1. Tool Call Flow

1. `@agentsy/runtime` detects a tool call targeted at an MCP server.
2. `MCPOrchestrator` routes the request to the correct active `MCPClient`.
3. The client serializes the call into MCP-compliant JSON-RPC.
4. The transport sends the request to the server.
5. The result is received, validated, and returned to the runtime.

### 2. Auto-Install Flow

1. Agent realizes it lacks a specific tool (e.g., "how to query Postgres").
2. Agent invokes `mai_search` (from bundled auto-install).
3. Agent selects a server and invokes `mai_install`.
4. `MCPOrchestrator` downloads the server, updates the config, and launches the new connection.

## Key Interfaces

### MCPOrchestrator

```typescript
export interface MCPOrchestrator {
  connect(config: ServerConfig): Promise<MCPClient>;
  disconnect(serverId: string): Promise<void>;
  listServers(): ServerInfo[];
  callTool(serverId: string, tool: string, args: unknown): Promise<unknown>;
}
```

### ServerConfig

```typescript
export interface ServerConfig {
  id: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  trustLevel: 'trusted' | 'untrusted' | 'readonly';
}
```

## Implementation Details

### Trust Model

Untrusted servers must be restricted from invoking destructive built-in tools or accessing sensitive resources without explicit human approval.

### Transport Resilience

The Stdio transport must handle server crashes gracefully, implementing an exponential backoff retry strategy for restarts.

## Sources Synthesized

`agentsy-fileops-mcp.md`, `agentsy-platform-v2.md`, `DECISION-LOG.md`, `packages/mcp/IMPLEMENTATION-PLAN.md`.

---

## MCP Auto-Install Extension (Phase 7)

### Requirements

- **REQ-031**: Bundle `@mcpmarket/mcp-auto-install@^0.2.1` as a child process in `@agentsy/mcp`, exposing 5 tools: `mai_search`, `mai_details`, `mai_readme`, `mai_install`, `mai_remove`.
- **REQ-032**: `mai_install` defaults to `dryRun: true`; actual installation requires `{ confirm: true }` (SEC-012).
- **SEC-012**: `mai_install` never executes without explicit `{ confirm: true }` flag to prevent accidental package installation.
- **DEP-006**: `@mcpmarket/mcp-auto-install@^0.2.1` — spawned as devDependency child process, not a runtime import.
- **ASSUMPTION-011**: `@mcpmarket/mcp-auto-install` is backed by the official MCP Registry and search results remain accurate at v0.2.1.
- **RISK-012**: `@mcpmarket/mcp-auto-install` v0.2.1 may have breaking changes in minor releases. Mitigation: pin to `^0.2.1`; monitor changelog.
- **ADR-021**: MCP Auto-Install in dryRun by default — actual install requires explicit confirm flag.

### Types (`src/meta-server.ts`)

```ts
interface MCPAutoInstallOptions {
  enabled?: boolean;
  settingsPath?: string;
  registryPath?: string;
  allowInstall?: boolean; // must be true for mai_install confirm:true to work
}
```

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-F7-001 | Add `@mcpmarket/mcp-auto-install@^0.2.1` as devDependency in `packages/mcp/package.json`.                                                                                                                                               |
| TASK-F7-002 | Implement `MCPAutoInstallServer` in `packages/mcp/src/meta-server.ts`. Spawns `@mcpmarket/mcp-auto-install` as stdio child process. Registers server as `__mai__`.                                                                      |
| TASK-F7-003 | Implement `mai_search(query: string)` passthrough. Forward to child process; return parsed JSON results array.                                                                                                                          |
| TASK-F7-004 | Implement `mai_details(serverId: string)` and `mai_readme(serverId: string)` read-only passthroughs.                                                                                                                                    |
| TASK-F7-005 | Implement `mai_install(serverId: string, options?: { confirm?: boolean })`. Default `dryRun: true`. Only execute install when `options.confirm === true` AND `MCPAutoInstallOptions.allowInstall === true` (SEC-012 double gate).       |
| TASK-F7-006 | Implement `mai_remove(serverId: string, options?: { confirm?: boolean })`. Same dryRun double-gate as `mai_install`.                                                                                                                    |
| TASK-F7-007 | Export `createMCPAutoInstallServer(opts: MCPAutoInstallOptions)` factory from `packages/mcp/src/index.ts`. Write tests in `packages/mcp/src/meta-server.test.ts`: dryRun by default, confirm gate, read-only operations always allowed. |

### Slash Command Stubs

Create SKILL.md files in `packages/mcp/src/skills/`:

- `/mcp-list.md` — lists installed MCP servers via `mai_search` tool call
- `/mcp-install.md` — guides user through `mai_search` then `mai_install` with confirm prompt

---

## FileOps exposure note (from `agentsy-fileops-mcp.md`)

We are **not** creating `@agentsy/fileops-mcp` as a separate package. File operations are planned under `@agentsy/tools` and can be exposed in MCP contexts by bridging those tool definitions through `@agentsy/mcp`.

### Bridge expectations

- `@agentsy/mcp` should support hosting tool definitions sourced from `@agentsy/tools` (including future `fileops_*` tools).
- `@agentsy/mcp` remains transport and orchestration focused; implementation logic lives in the originating package.
- Security posture remains unchanged: trust-level filtering, dry-run defaults for mutating meta-install actions, and explicit confirmation gates.

### Verification

- Inspector should list bridged `fileops_*` tools with correct read-only vs destructive hints.
- Errors from bridged tools should be normalized into MCP-friendly structured responses.

### Interop implementation notes

- Keep the MCP transport and orchestrator responsible for lifecycle; companion protocol bridges should only translate envelopes and metadata.
- If a bridge needs UI payloads, emit declarative data structures rather than embedding client framework code.
- When auto-installing or auto-discovering tools, preserve trust-level filtering so new protocol bridges do not silently escalate capability.

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Orchestrator and server contracts

```typescript
type MCPTransport = 'stdio' | 'websocket' | 'http';
type MCPTrustLevel = 'trusted' | 'untrusted' | 'readonly';

interface MCPServerConfig {
  name: string;
  transport: MCPTransport;
  trustLevel?: MCPTrustLevel;
  connectionIdleTimeoutMs?: number;
  startupTimeoutMs?: number;
}
```

### Runtime expectations preserved

- Trust-level filtering is mandatory before tool exposure.
- Idle-timeout defaults and startup-timeout boundaries stay enforced.
- MCP remains transport/orchestration-only; tool implementation logic belongs in source packages (for example, `@agentsy/tools`).
