# Subagents

- Subagents are best understood as **specialized workers** with narrow context and clear responsibilities.
- The dominant patterns are:
  - **coordinator/worker**
  - **parallel fan-out**
  - **chained delegation**
  - **agent pools / long-lived workers**
- Good subagents have:
  - a clear purpose
  - a constrained tool set
  - a strong description/invocation contract
  - isolated context
  - explicit permissions and sandboxing
- They are most useful for:
  - research
  - code review
  - refactoring
  - test generation
  - security checks
  - multi-perspective analysis
- They are **not** great for:
  - tight real-time workflows
  - tasks that need deterministic, step-by-step execution
  - workflows where the main agent must retain full shared context

## A2A

- A2A is a **real interoperability protocol**, not just an orchestration pattern.
- The spec centers on:
  - **agent discovery** via **Agent Cards**
  - a **canonical data model**
  - **abstract operations**
  - **protocol bindings** such as JSON-RPC, HTTP/REST, and gRPC
  - **sync, streaming, and async** communication modes
  - **security** via authn/authz and access control
  - **standardized errors**
  - **extensions** without breaking core compatibility
- A2A matters when agents cross:
  - frameworks
  - vendors
  - processes
  - trust boundaries
  - ownership boundaries

### ACP

- ACP is the **client/server and editor-facing protocol layer** for agent sessions, not a substitute for local subagent orchestration.
- Plan 1 for ACP should expose an ACP-compatible transport and discovery layer with:
  - REST-first requests
  - synchronous, asynchronous, and streaming communication
  - stateful and stateless operation
  - offline discovery metadata
  - standardized errors
  - authn/authz boundaries
- ACP Client support should cover the editor session lifecycle:
  - initialize
  - authenticate
  - session creation and loading
  - prompt turns
  - progress updates
  - cancellation
  - gated file and terminal operations
- ACP should be implemented as a protocol layer that can wrap existing Agentsy runtimes without forcing orchestration logic into the transport.

## The key architectural takeaway for Agentsy

These should **not** be treated as the same thing.

- **Subagents** = local orchestration pattern inside Agentsy
- **ACP** = editor/client ↔ agent protocol layer for sessions and gated operations
- **A2A** = external agent-to-agent interoperability layer between independent agent systems

So I would not make one monolithic “agent” abstraction that tries to do all of them badly.

I would build a **three-layer module design**:

- `@agentsy/subagents` for local delegation and orchestration
- `@agentsy/acp` and `@agentsy/acp-client` for protocol, discovery, transport, and session control
- `@agentsy/a2a` for remote agent-to-agent interoperability
- optionally, a thin umbrella package such as `@agentsy/agent-interop` or `@agentsy/multi-agent` that ties them together

## Recommended module shape

### 1) `@agentsy/subagents`

This is the local orchestration layer.

#### Responsibilities

- define subagent descriptors
- spawn / run / await subagent tasks
- support coordinator-worker patterns
- support fan-out and result aggregation
- enforce tool and permission boundaries
- support chained delegation
- normalize subagent outputs into Agentsy event streams

#### Core concepts

- `SubagentDefinition`
- `SubagentTask`
- `SubagentResult`
- `SubagentPolicy`
- `DelegationStrategy`
- `SubagentContext`

#### Suggested APIs

- `createSubagentCoordinator(...)`
- `spawnSubagent(...)`
- `runSubagentTask(...)`
- `awaitSubagents(...)`
- `mergeSubagentResults(...)`
- `createDelegationPolicy(...)`

### 2) `@agentsy/a2a`

This is the interoperability layer.

#### Responsibilities

- represent A2A agent cards
- validate A2A messages and envelopes
- support protocol bindings
- expose discovery and capability matching
- map A2A streams into Agentsy processor events
- support transport adapters
- handle auth, authz, and error normalization

#### Core concepts

- `AgentCard`
- `A2ARequest`
- `A2AResponse`
- `A2AStreamEvent`
- `A2AError`
- `A2ATransport`
- `DiscoveryClient`
- `CapabilityMatcher`

#### Suggested APIs

- `parseAgentCard(...)`
- `validateAgentCard(...)`
- `discoverAgents(...)`
- `connectA2AAgent(...)`
- `sendA2AMessage(...)`
- `streamA2AConversation(...)`
- `mapA2AError(...)`

### 3) Optional umbrella facade: `@agentsy/agent-interop`

This would provide a single entry point for users who want both local subagents and remote A2A agents.

#### Responsibilities

- unify local and remote agent targets
- present one orchestration API
- hide transport differences
- let a coordinator choose:
  - local subagent
  - remote A2A agent
  - mixed fan-out

#### Core concepts

- `AgentTarget`
- `AgentRegistry`
- `Orchestrator`
- `WorkerHandle`
- `RemoteAgentHandle`

## How it should fit with the current codebase

This new module should build on the packages you already have:

- `@agentsy/processor` for event orchestration
- `@agentsy/structured` for schema validation and contract shaping
- `@agentsy/tool-calls` for tool invocation translation
- `@agentsy/recovery` for continuation and resumption
- `@agentsy/types` for shared contracts
- `@agentsy/ag-ui` and `@agentsy/ui` for state projection if needed
- `@agentsy/retry` for transient transport retries, once that package is formalized

That keeps the new layer consistent with your current architecture: small, focused packages with explicit boundaries.

## Proposed plan document

If I were writing this in the same style as your secrets plan, I’d structure it like this:

## Plan: Subagents and A2A Module for Agentsy

### 1. Background analysis

- summarize subagent patterns from VS Code, Claude Code, Codex, LangChain, and Copilot guidance
- summarize A2A as the interoperability standard for agent-to-agent communication
- distinguish local orchestration from cross-system protocol concerns

### 2. Requirements for Agentsy

- local subagent delegation
- fan-out and chained workflows
- remote agent discovery and transport
- standardized agent identity and capabilities
- permission and tool controls
- stream-friendly event handling
- strong validation and security boundaries
- compatibility with existing Agentsy packages

### 3. Proposed architecture

#### 3.1 New packages

- `@agentsy/subagents`
- `@agentsy/a2a`
- optional `@agentsy/agent-interop`

#### 3.2 Shared contracts

- `AgentCard`
- `SubagentDefinition`
- `AgentTarget`
- `DelegationStrategy`
- `TransportAdapter`
- `AgentEvent`

#### 3.3 Runtime model

- local coordinator
- local worker subagents
- remote A2A agents
- result normalization into shared stream events

#### 3.4 Transport model

- JSON-RPC support first
- HTTP/REST binding
- streaming support
- room for gRPC later if needed

#### 3.5 Security model

- explicit capabilities
- tool allowlists
- authn/authz for A2A endpoints
- no implicit trust across remote boundaries
- no silent context leakage

### 4. Implementation plan

#### Phase 1: shared types and validation

- add Agent Card and subagent contracts
- add schema validation
- define common event shapes
- add tests for type narrowing and serialization

#### Phase 2: local subagent orchestration

- implement coordinator/worker API
- support sequential and parallel delegation
- support result aggregation
- integrate with current processor and tool-call flows
- add tests for isolated context and permission handling

#### Phase 3: A2A protocol support

- implement agent discovery
- parse and validate agent cards
- implement JSON-RPC transport
- add streaming and async message support
- normalize A2A errors into Agentsy error types

#### Phase 4: bridge local and remote agents

- unify local subagents and remote A2A agents behind one target interface
- support mixed fan-out
- allow a coordinator to route tasks by capability, policy, or cost
- add replay/resumption support if streams are interrupted

#### Phase 5: integrations

- add VS Code-facing helpers if needed
- add CLI/dev tooling for inspection
- add examples and docs
- add package catalog and architecture docs

### 5. Risk mitigation

- keep subagents local-first
- do not overfit to one vendor’s UX
- keep A2A transport optional and adapter-based
- require explicit capability declarations
- avoid recursive “agents spawning agents forever” designs
- keep outputs structured and bounded
- treat remote agents as untrusted by default

### 6. Summary

- local subagents are an orchestration feature
- A2A is a protocol feature
- they should share contracts, not implementation assumptions
- Agentsy should expose both through a clean, layered design

### My recommendation

I would start with this scope:

#### MVP

- local subagent coordinator
- agent card parsing/validation
- A2A client transport over JSON-RPC/HTTP
- shared result/event model
- simple fan-out and chained delegation

#### Defer for later

- long-lived agent pools
- team-of-agents coordination
- gRPC binding
- advanced remote capability negotiation
- cross-vendor agent marketplace/discovery features

That keeps the first version useful without exploding the surface area.

### My preferred package naming

If you want the cleanest monorepo shape, I’d do:

- `@agentsy/subagents`
- `@agentsy/a2a`

And only add:

- `@agentsy/agent-interop`

if you want a convenience facade.

If you want, I can turn this into a **full draft plan file** in the same style as `plan/agentsy-secrets.md`.
