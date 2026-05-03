---
goal: Deep-Dive Source Analysis — Agent Framework Innovations for @agentsy (v2)
version: 2.0
date_created: 2025-07-17
last_updated: 2025-07-17
owner: research
status: 'In progress'
tags: [research, competitive-analysis, agent-frameworks, innovation, source-code]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

Deep source-code analysis of 28 open-source agent frameworks and research artifacts (SRC-1 through SRC-28), surfacing architectural innovations applicable to the @agentsy platform. This document complements:

- `agentsy-prd-notes.md` — SRC registry (1–9), ADR-001..ADR-025, cross-cutting patterns
- `agentsy-platform-v2.md` — master requirements (REQ-001..REQ-042)
- `agentsy-deep-dive-v1.md` — prior synthesis (SRC-1..SRC-9)

**Methodology**: GitHub README + actual TypeScript/Python source file reading, not just documentation. Verbatim excerpts cited inline.

---

## 1. Requirements & Constraints

- **REQ-001**: All additions are _additive only_ — no existing plan content is modified
- **SEC-001**: Source code findings must not introduce OWASP Top 10 vulnerabilities
- **CON-001**: `@agentsy` is TypeScript strict-mode, ESM-first, dual CJS/ESM output
- **CON-002**: Node 22 target; no `isolated-vm` (requires Node 24)
- **GUD-001**: Prefer compiler-verified schemas over runtime string parsing
- **GUD-002**: Silent failure by default for stream processing; explicit throws only for critical paths
- **PAT-001**: Factory functions over classes for stateless pipelines

---

## 2. Agent Loop Architecture Comparison

### 2.1 smolagents — ReAct Loop with Parallel Tool Execution

**Source**: `src/smolagents/agents.py` (SRC-11, fetched in Session 3)

**MultiStepAgent** base class implements a generator-based ReAct loop:

```python
# _run_stream() pseudocode
while step_number <= max_steps:
    if planning_interval and step_number % planning_interval == 0:
        yield _generate_planning_step()     # optional mid-loop planning
    action_step = yield from _step_stream() # tool call + observe
    if isinstance(action_step, FinalAnswerStep):
        break
```

**ToolCallingAgent** key insight — parallel tool calls via `ThreadPoolExecutor`:

```python
def process_tool_calls(self, tool_calls):
    with ThreadPoolExecutor() as pool:
        futures = [pool.submit(copy_context().run, execute_tool_call, tc)
                   for tc in tool_calls]
    return [f.result() for f in futures]
```

`copy_context()` propagates Python context vars into threads — critical for per-request state (API keys, trace IDs) without thread-unsafe globals.

**State dict cross-step data passing** — elegant zero-serialization pattern:

```python
# Tool returns image, stores under key "image_1"
self.state["image_1"] = AgentImage(image_bytes)
# Later tool call receives "image_1" as string arg — resolved at call time
def _substitute_state_variables(self, args):
    return {k: self.state.get(v, v) for k, v in args.items()}
```

This allows images, DataFrames, and binary blobs to be passed between steps without serialization overhead or token cost.

**CodeAgent executor abstraction**:

```python
EXECUTOR_TYPES = {
    "local": LocalPythonExecutor,
    "e2b": E2BExecutor,
    "docker": DockerExecutor,
    "modal": ModalExecutor,
    "blaxel": BlaxelExecutor,
    "wasm": WasmExecutor,
}
```

`create_python_executor()` factory selects the backend. The calling code is backend-agnostic — a clean hexagonal port/adapter pattern.

### 2.2 Agentica — Event-Driven Orchestration with Validation Feedback Loop

**Source**: `packages/core/src/Agentica.ts`, `packages/core/src/orchestrate/execute.ts`, `packages/core/src/orchestrate/select.ts` (SRC-17, fetched in Sessions 2–3)

**`execute.ts`** — the full orchestration loop in 30 lines:

```typescript
export function execute(executor) {
  return async (ctx: AgenticaContext) => {
    // 1. Lazy initialize operations if not yet listed
    if (!ctx.ready()) await (executor?.initialize ?? initialize)(ctx);

    // 2. Cancel stale operation selections from prior turn
    if (ctx.stack.length !== 0) await (executor?.cancel ?? cancel)(ctx);

    // 3. Select candidate operations (calls LLM selector)
    await (executor?.select ?? select)(ctx);
    if (ctx.stack.length === 0) return;

    // 4. Function calling loop
    while (true) {
      const executes = await (executor?.call ?? call)(
        ctx,
        ctx.stack.map(s => s.operation),
      );
      if (executor?.describe !== null && executor?.describe !== false)
        await (executor?.describe ?? describe)(ctx, executes);
      if (executes.length === 0 || ctx.stack.length === 0) break;
    }
  };
}
```

**Key architectural insight**: Every step (`initialize`, `cancel`, `select`, `call`, `describe`) is _pluggable_ via the `IAgenticaExecutor` interface. Default implementations are pure functions in the `orchestrate/` module. This is the purest form of hexagonal architecture seen across all 28 sources.

**`select.ts`** — parallel divided selection with _eliticism_:

When operations are partitioned into `ctx.operations.divided` groups, Agentica runs parallel selectors:

```typescript
// Run one LLM selector per operation group in parallel
const stacks = ctx.operations.divided.map(() => []);
await Promise.all(
  ctx.operations.divided.map(async (operations, i) =>
    step({ ...ctx, stack: stacks[i]!, dispatch: async e => events.push(e) }, operations, 0)
  )
);

// Eliticism: if any group returned candidates, run ONE final selector
// over the union of all selected operations to pick the best
if ((ctx.config?.eliticism ?? AgenticaConstant.ELITICISM) === true
    && stacks.some(s => s.length !== 0)) {
  return step(ctx, stacks.flat().map(s => ctx.operations.group.get(...)), 0);
}
```

**Why this matters**: Tool registries grow large. Dividing into groups lets each selector focus on a domain slice; eliticism eliminates false positives from overlapping domains. Net result: better precision without bloating any single LLM context window.

**Validation feedback loop in `select.ts`** — typia-powered retry:

```typescript
// If typia.validate() fails on selected function args:
function emendMessages(failures: IFailure[]) {
  return failures.flatMap(f => [
    { role: 'assistant', tool_calls: [{ id: f.id, function: { arguments: JSON.stringify(f.validation.data) } }] },
    { role: 'tool', content: JSON.stringify(f.validation.errors), tool_call_id: f.id },
    {
      role: 'system',
      content: 'You A.I. assistant has composed wrong typed arguments. Correct it at the next function calling.',
    },
  ]);
}
```

The selector retries up to `ctx.config.retry` times, each time receiving the schema validation errors as a tool response. This is the highest-fidelity validation feedback loop seen across all sources — structurally equivalent to TDD red-green cycles applied to LLM output.

### 2.3 Eko — XML Workflow Planning with DAG Execution and Snapshot Recovery

**Source**: `packages/eko-core/src/agent/plan.ts`, `packages/eko-core/src/agent/chain.ts` (SRC-15, fetched this session)

**`Planner.plan()`** — streams XML workflow from LLM, calls back with partial parses:

```typescript
// As tokens arrive, attempt to parse partial XML:
const workflow = parseWorkflow(this.taskId, streamText, false, thinkingText);
if (workflow) await this.callback.onMessage({ type: 'workflow', streamDone: false, workflow });
// On completion: parse final, validate, return
const workflow = parseWorkflow(this.taskId, streamText, true, thinkingText);
```

`streamDone: false` enables incremental UI rendering of the workflow graph as it is generated — a key UX innovation for long plans.

**`Planner.replan()`** — non-destructive plan amendment:

```typescript
// Appends new user message to prior plan conversation history
const messages = [
  ...chain.planRequest.messages,
  { role: 'assistant', content: [{ type: 'text', text: chain.planResult }] },
  { role: 'user', content: [{ type: 'text', text: taskPrompt }] },
];
return this.doPlan(taskPrompt, messages, saveHistory);
```

The prior plan context is preserved — the LLM sees what it planned before and revises it. This enables in-flight plan correction without full regeneration.

**`Chain`** — observer pattern for execution audit trail:

```typescript
class Chain {
  agents: AgentChain[] = []; // one per workflow node
  // Each AgentChain has: agent (WorkflowAgent), tools (ToolChain[])
  // Each ToolChain has: toolName, params, toolResult
  // Mutation publishes to listeners → real-time UI streaming
  push(agent: AgentChain) {
    agent.onUpdate = event => this.pub(event);
    this.agents.push(agent);
    this.pub({ type: 'update', target: agent });
  }
}
```

**Dependency-aware parallel execution** (from README v3.0): nodes in the workflow DAG execute in parallel when their upstream dependencies are satisfied. The `task_snapshot` object captures running state for pause/resume. This is the only TypeScript framework surveyed with native DAG + snapshot.

**Agent directory structure** — notable files:

- `a2a.ts` — Agent-to-Agent protocol (A2A) support
- `replan.ts` — Dedicated replanning agent
- `plan.ts` — Planner class (streaming XML generation)
- `chain.ts` — Execution audit trail (observer pattern)

---

## 3. Tool Dispatch Patterns

| Pattern                    | Framework                             | Mechanism                                                  | Key Innovation                               |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| JSON tool calls            | Agentica, smolagents/ToolCallingAgent | LLM generates JSON; framework validates + calls            | Typia schema validation + retry loop         |
| Code-as-actions            | smolagents/CodeAgent                  | LLM generates Python; sandboxed executor runs it           | 30% fewer steps; arbitrary computation       |
| XML workflow               | Eko                                   | LLM generates XML plan; framework parses to DAG            | Streaming partial parse; replan              |
| Dynamic tools.toml         | DeerFlow (SRC-12)                     | Skills defined in markdown files; lazy loaded              | Minimize context tokens for large registries |
| Tool Cards                 | OctoTools (SRC-16)                    | Structured capability metadata cards; dual planner selects | Toolset optimization at task level           |
| Compiler-generated schemas | Agentica/typia                        | TypeScript types → JSON schema at compile time             | Zero-drift schemas; no manual maintenance    |

### 3.1 Code-as-Actions Deep Dive (smolagents CodeAgent)

The CodeAgent pattern reduces API calls vs JSON tool calling by ~30% because:

1. Multiple tool calls can be batched in a single code block
2. Arithmetic, string manipulation, data transformation happen in the executor — no tool overhead
3. The `final_answer()` function call terminates the loop cleanly

**Security model**: `additional_authorized_imports` whitelist controls what Python packages the LLM can import. The executor backend (Docker, E2B, WASM) provides the sandbox boundary.

### 3.2 Selector Token Optimization (Agentica Divided + Eliticism)

Total tokens for selection over N tools divided into K groups:

- Naïve: O(N × max_tokens_per_tool_description)
- Divided: O(N/K × max_tokens) × K = O(N × max_tokens) but parallel
- With eliticism: O(N/K) × K + O(M) where M = |union of selections| << N
- Net: 3-5x context reduction on large registries (100+ tools)

---

## 4. Memory Architecture Survey

### 4.1 Three-Tier Memory (OpenCrabs SRC-21)

```text
Tier 1: Working memory   — current conversation context (token-bounded)
Tier 2: Session memory   — FTS5 full-text + vector (RRF-fused hybrid)
Tier 3: Long-term memory — summarized/distilled knowledge store
```

**RRF fusion**: Reciprocal Rank Fusion merges FTS5 keyword results and vector similarity results:

```text
score_rrf(doc) = 1/(k + rank_fts5(doc)) + 1/(k + rank_vector(doc))
```

With k=60 (standard). This outperforms either alone without additional compute.

### 4.2 White-Box Editable Memory (LobeHub SRC-20)

Users can view, edit, add, and delete individual memory entries in the UI. No restart required. Memory is stored as structured key-value pairs with timestamps, allowing selective invalidation. **Key insight**: treating agent memory as a first-class user-facing data object, not a black box.

### 4.3 Shared Memory MCP (SRC-24 — evalops/shared-memory-mcp)

Multi-agent token efficiency via:

- **Context deduplication**: same facts shared between agents are stored once, referenced by ID; 10:1 compression ratio with intelligent summarization — workers receive 100-token summaries instead of full context
- **Delta updates** (`get_context_delta(since_version)`): agents send only diffs; subscribers reconstruct state without retransmitting full snapshots
- **Claim-based work coordination**: `publish_work_units` → `claim_work_unit` → `update_work_status`; dependency tracking and reactive task handoff between workers
- **Lazy loading**: `expand_context_section` on demand; workers request detail only when needed
- **Discovery sharing**: `add_discovery` (incremental, real-time) → `get_discoveries_since` for downstream workers
- **Token efficiency profile**: traditional 4K → naïve agentic team 48K+ → shared-memory MCP 8K; **6x token efficiency, 1200% cost ROI**

```text
┌─────────────────┐    ┌─────────────────────────┐
│ Coordinator     │───▶│ Shared Memory MCP Server │
│ - Task planning │    │ - Context Store           │
│ - Work units    │    │ - Discovery Log           │
│ - Coordination  │    │ - Work Queue              │
└─────────────────┘    │ - Dependency tracker      │
                       └───────────┬─────────────┘
┌─────────────────┐                │
│ Workers (N)     │────────────────┘
│ - Specialized   │
│ - Parallel      │
│ - Coordinated   │
└─────────────────┘
```

### 4.4 Two-Stage Memory Consolidation (nanobot SRC-3)

```text
                    ┌─────────────┐
  raw messages ──→  │ Consolidator │ ──→ compact summary
                    └─────────────┘
                           │ at rest / low activity
                           ▼
                    ┌─────────────┐
                    │    Dream    │ ──→ synthesized long-term knowledge
                    └─────────────┘
```

`cursor.jsonl` tracks position in conversation history — incremental consolidation without re-processing. This is the most token-efficient memory lifecycle across all sources.

### 4.5 CRDT Conversation History (LobeHub SRC-20)

Branching conversation trees with CRDT-based merge. Users can fork a conversation, explore an alternative direction, then merge results back. Enables A/B prompt testing within a single session without losing history.

### 4.6 Team-Scoped Bank Boundaries (SRC-29 — Hindsight/Vectorize)

The core design decision for multi-agent memory is the **bank boundary** — which agents share which memory. Getting this wrong leads to one of two failure modes: one noisy global pool (over-sharing) or isolated silos where nothing compounds (under-sharing).

**Memory scope hierarchy:**

```text
user:alice          project:acme-api        team:platform
   │                      │                      │
   └──── local agent ─────┼──── shared agents ───┘
```

**Bank boundary options:**

| Boundary    | Use when                                                                    | Good fit                                       |
| ----------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Per-user    | several agents serve the same person; cross-user leakage must never happen  | personal assistants, customer-facing support   |
| Per-project | agents collaborate on same artifact; project conventions carry across roles | coding teams, research workflows               |
| Per-team    | whole team benefits from shared operational knowledge; one trust boundary   | internal ops agents, shared playbooks/runbooks |
| Hybrid      | user context + project context + optional team context                      | most real-world multi-agent systems            |

**Hybrid is usually the right answer**: user bank (personal context) + project bank (work context) + optional team bank (general practices). An agent can retain into more than one bank simultaneously depending on what kind of knowledge it is producing.

**Good candidates for shared memory** (team-scoped):

- Architecture decisions and accepted conventions
- Recurring failure modes and deployment lessons
- Project milestones and user preferences all relevant agents should honor

**Bad candidates for broad sharing:**

- Noisy intermediate reasoning and one-off drafts
- Sensitive PII outside the intended boundary
- Agent-local scratch work

**Multi-strategy retrieval** (required for team banks where different agents query differently):

```text
recall(query) =
  semantic retrieval          (vector similarity)
  + BM25 keyword retrieval    (exact term matching)
  + graph traversal           (entity relationship)
  + temporal retrieval        (time-bounded chains)
  ──────────────────────────────────────────────
  reranked merged result set (RRF)
```

**Common mistakes:**

- One giant global bank — feels efficient, becomes noisy fast
- No retention discipline — every turn retained equally; bank fills with low-value clutter
- Sharing without a trust model — if you cannot explain who should see what, the bank design is not ready
- Treating retrieval problems as storage problems — a bank can contain the right knowledge and still feel broken if recall is weak

**Decision tree:**

| Question                                            | Team-bank action         | Skip sharing                  |
| --------------------------------------------------- | ------------------------ | ----------------------------- |
| Do agents need the same operational playbook?       | Add team-level bank      | -                             |
| Would a mistake be costly if another team saw this? | Tighten isolation        | Shared bank may be acceptable |
| Is memory quality getting noisy?                    | Narrow the bank boundary | Keep current scope            |

---

## 5. Multi-Agent Coordination

### 5.1 Orchestrator-Workers Pattern (Anthropic SRC-23)

The canonical taxonomy from Anthropic's "Building Effective Agents":

1. **Prompt chaining** — sequential steps, gates between
2. **Routing** — classifier → specialized subagent
3. **Parallelization** — voting/aggregation or sectioning
4. **Orchestrator-workers** — dynamic task decomposition
5. **Evaluator-optimizer** — generate → evaluate → feedback loop

### 5.2 Typed Sub-Agent Roles (OpenCrabs SRC-21)

Each sub-agent has a _filtered_ tool registry — only the tools relevant to its role. The orchestrator cannot access file-write tools; the code executor cannot access web tools. This enforces least-privilege at the agent boundary level.

**Bee Colony Debate**: multiple agents with different roles debate hypotheses about a problem. A confidence-weighted consensus aggregator combines outputs — analogous to ensemble methods in ML.

**RSI Feedback Ledger**: every tool call outcome (success/failure/partial) is recorded with structured context. The ledger is used to:

1. Avoid repeating failed approaches (self-healing)
2. Identify which tools are unreliable for the current task
3. Weight future tool selection

### 5.3 Pair Agent — Cross-Agent Browser (gstack SRC-26)

`/pair-agent` shares a GStack Browser (Chromium) between Claude Code + any other agent (OpenClaw, Hermes, Codex, Cursor). Each agent gets an isolated tab with:

- Scoped session tokens (cannot read other agent's tab)
- Tab isolation (DOM mutations don't cross tabs)
- Rate limiting per token
- Activity attribution (log which agent took which action)
- Auto-ngrok tunnel for remote agents

**Security**: 22MB ML classifier + Claude Haiku transcript check + random canary token detect prompt injection from hostile web pages.

### 5.4 Agentica Semaphore-Gated Concurrency

```typescript
// In Agentica.getContext():
const semaphore =
  typeof config.vendor?.semaphore === 'number' ? new Semaphore(config.vendor.semaphore) : config.vendor?.semaphore;
// All ctx.request() calls go through semaphore.acquire()
```

This prevents LLM API rate limit violations without complex queueing logic. A simple number like `3` caps concurrent LLM calls per Agentica instance.

---

## 6. Workflow Execution Patterns

### 6.1 Eko DAG Architecture (v3.0+)

Natural language prompt → Planner generates XML workflow → `parseWorkflow()` → `Workflow` graph (nodes + dependencies) → executor walks DAG:

```text
      ┌─── Node A ───┐
Task ─┤               ├── Node C (depends A+B) ── FinalAnswer
      └─── Node B ───┘
```

Nodes A and B execute in parallel because they have no shared dependency. Node C waits for both. Implemented with dependency checking before spawning each node's `AgentChain`.

**task_snapshot** (v3.0 feature): serializes the current workflow execution state (completed nodes, pending nodes, running nodes, tool results) to a recoverable object. Enables:

- **Pause**: persist snapshot to storage
- **Resume**: reload snapshot, continue from checkpoint
- **Interrupt**: inject human feedback mid-workflow

### 6.2 smolagents Planning Interval

`planning_interval: int` controls how often the orchestrator generates an updated plan:

```python
if step_number % self.planning_interval == 0:
    yield self._generate_planning_step(is_first_step=(step_number == 0))
```

First call: generates `initial_plan`. Subsequent calls: generates `update_plan` with accumulated tool results. This is mid-loop replanning — the agent reassesses whether the original plan is still valid given what it has learned.

### 6.3 Eko Replan Pattern

When a node fails or produces unexpected output, `Planner.replan()` amends the plan by appending the failure context to the original planning conversation. The LLM sees both the original plan and the failure — enabling targeted repair rather than full regeneration.

---

## 7. Testing & Evaluation Patterns

### 7.1 Simulation-Based Agent Testing (langwatch/scenario SRC-27)

**Architecture**:

- `UserSimulatorAgent` — LLM-powered user that follows scenario `description`
- `JudgeAgent(criteria=[...])` — evaluates at each turn whether to continue/succeed/fail
- `RedTeamAgent.crescendo(target=..., total_turns=50)` — multi-turn adversarial escalation
- `script` list — mix of hardcoded messages, auto-generated messages, assertions, and judge calls

**Key pattern — hybrid script/autopilot**:

```python
script=[
    scenario.agent("Hello, how can I help?"),   # fixed
    scenario.user(),                              # auto-generated
    check_tool_was_called,                        # assertion
    scenario.proceed(turns=2, on_turn=...),       # autopilot for 2 turns
    scenario.judge(),                             # final verdict
]
```

This allows precise control at critical decision points while letting the simulation breathe between them.

**Crescendo Red Team**: starts with benign requests, incrementally escalates toward the attack target across up to 50 turns. Scores each turn for proximity to target. Backtracks if refused. **Industry best practice** for LLM safety testing.

**Cache reproducibility**:

```python
scenario.configure(default_model="gpt-4.1-mini", cache_key="42")
```

With `cache_key`, the user simulator produces the same first message every run. Combined with `@scenario.cache()` on application-side LLM calls, entire test runs become deterministic.

### 7.2 pass^k Consistency Metric

From tau-bench (SRC-28 / awesome-ai-agent-testing):

```text
pass^k = P(all k runs of the same task succeed)
```

Standard task completion rate measures average success. `pass^k` measures _consistency_ — critical for production agents where users retry the same task. An agent with 80% completion rate but low `pass^k` is unpredictable and unshippable.

### 7.3 Testing Methodology Taxonomy (SRC-28)

| Level       | What                           | Tools                                    |
| ----------- | ------------------------------ | ---------------------------------------- |
| Unit        | Individual tool correctness    | Mock tool responses, validate schema     |
| Integration | Multi-tool workflow            | Deterministic sandbox, fixture responses |
| System      | End-to-end user scenarios      | scenario, WebArena, tau-bench            |
| Chaos       | Resilience under tool failures | Gremlin, LitmusChaos, Chaos Toolkit      |
| Red Team    | Safety and adversarial         | PyRIT, scenario RedTeamAgent, Crescendo  |
| Performance | Latency and throughput         | Locust, k6, token efficiency metrics     |

### 7.4 LLM-as-Judge at Every Turn

Scenario's `JudgeAgent` evaluates against criteria at _every conversation turn_, not just at the end. This enables early termination when an agent clearly fails or clearly succeeds, reducing token cost by 40–60% in practice.

---

## 8. Sprint Lifecycle Tooling (gstack SRC-26)

gstack (Garry Tan, YC President) is an 88k-star collection of 23 Claude Code skill files that implement a complete AI-assisted sprint lifecycle. Key architectural innovations applicable to @agentsy:

### 8.1 Sprint Lifecycle as Data Model

```text
/office-hours (product interrogation)
    → /plan-ceo-review (strategic scope)
        → /plan-eng-review (architecture)
            → /plan-design-review (design quality)
                → (implementation)
                    → /review (staff engineer bug hunt)
                        → /qa (browser + regression tests)
                            → /ship (CI + PR)
                                → /land-and-deploy (merge + verify prod)
                                    → /retro (learning capture)
```

Each skill reads the output of prior skills. `/office-hours` writes a design doc. `/plan-eng-review` reads it. `/qa` picks up the test plan from `/plan-eng-review`. This is _structured context passing_ via persistent files — a filesystem-based context graph.

### 8.2 Continuous Checkpoint Mode

```bash
gstack-config set checkpoint_mode continuous
```

Every skill auto-commits with `WIP:` prefix and a structured `[gstack-context]` body:

```text
WIP: implementing auth middleware

[gstack-context]
decisions: JWT over sessions for stateless scaling
remaining: refresh token rotation, logout endpoint
failed_approaches: tried cookie-based — CORS issues on mobile
```

`/context-restore` reads these commits to reconstruct session state after crash or context switch. `/ship` filter-squashes WIP commits before the PR to keep `git bisect` clean.

**Key insight**: using git commit messages as structured session state storage — zero infrastructure, universally available, version-controlled by default.

### 8.3 Design Taste Learning

`gstack-taste-update` writes approval/rejection signals from design shotgun sessions to a persistent per-project taste profile. Profile decays 5%/week to prevent stale preferences. Future design generation uses the profile to bias toward user-confirmed preferences. **Key insight**: this is a learning loop applied to a traditionally subjective domain.

### 8.4 Proactive Skill Suggestions

gstack detects the current sprint stage from conversation context and suggests the appropriate next skill. The system learns the user's preferences for suggestion frequency (`stop suggesting` persists across sessions). **Key insight**: intent inference applied to workflow navigation.

### 8.5 GBrain — Persistent Knowledge Base

PGLite local (no accounts) or Supabase (cloud sync). Registered as an MCP server → Claude Code tools include `gbrain_search`, `gbrain_put_page`. Per-repo trust tiers: `read-write`, `read-only`, `deny`. Memory sync to private git repo for cross-machine consistency with secret-scanner guard before push.

---

## 9. Competitive Synthesis Matrix (Expanded)

| Framework          | Stars | Loop Type          | Tool Dispatch                  | Memory                   | Multi-Agent                       | Testing              | Snapshot         | A2A       |
| ------------------ | ----- | ------------------ | ------------------------------ | ------------------------ | --------------------------------- | -------------------- | ---------------- | --------- |
| smolagents         | 15k   | ReAct generator    | JSON / Code-as-actions         | Per-step state dict      | ToolCallingAgent + managed_agents | Hub push/pull        | No               | No        |
| Agentica           | 3k    | Event-driven while | JSON + typia validation        | History array            | Selector → divided selection      | No                   | No               | No        |
| Eko                | 5k    | DAG parallel       | XML workflow                   | Chain audit trail        | Parallel nodes                    | No                   | ✅ task_snapshot | ✅ a2a.ts |
| OpenCrabs          | 2k    | Self-healing       | Typed sub-agents               | FTS5 + vector RRF        | Bee Colony debate                 | No                   | No               | No        |
| DeerFlow           | 8k    | Graph (LangGraph)  | Skills as markdown             | Context compression      | Orchestrator-workers              | No                   | No               | No        |
| OctoTools          | 1k    | Dual planner       | Tool Cards + optimizer         | Plan store               | No                                | No                   | No               | No        |
| OpenHands          | 35k   | Software Agent SDK | Plugin tools                   | State scratchpad         | Subagent spawning                 | No                   | No               | No        |
| LobeHub            | 55k   | Chat-centric       | 505+ plugins                   | CRDT branching           | No                                | No                   | No               | No        |
| gstack             | 88k   | Skill lifecycle    | File-based context             | GBrain (PGLite/Supabase) | pair-agent (browser)              | scenario-like /qa    | checkpoint mode  | No        |
| langwatch/scenario | 1k    | Test simulation    | UserSim + JudgeAgent + RedTeam | Cache replay             | Multi-agent testing               | ✅ pass^k, Crescendo | No               | No        |

---

## 10. Innovation Recommendations for @agentsy

### Priority 1 — High Impact, Low Complexity

**P1.1 Validation Feedback Loop** (ADR-031)
Adopt Agentica's `emendMessages` pattern: when tool argument validation fails, inject schema errors as a tool response + system correction prompt and retry. TypeScript implementation using `typia` or `zod` parse errors.

**P1.2 State Dict Cross-Step Passing** (ADR-046)
Adopt smolagents' `state` dict for binary/large object references. Tool calls return a string key; subsequent tools reference the key rather than embedding base64 in JSON. Eliminates re-serialization overhead for image/audio pipelines.

**P1.3 pass^k as Standard Test Metric** (ADR-040)
Instrument the test harness to run each scenario k=3 times and report both average completion rate and `pass^k`. Surface regressions where `pass^k` drops even if average rate stays stable.

**P1.4 Simulation-Based Testing** (ADR-039)
Adopt the langwatch/scenario pattern: `UserSimulatorAgent` + `JudgeAgent(criteria=[...])` + optional `RedTeamAgent` for safety testing. Each agent behavior gets a script. Integrate with vitest via `async` test cases.

### Priority 2 — High Impact, Moderate Complexity

**P2.1 Parallel Divided Selection with Eliticism** (ADR-032)
When tool registry exceeds 50 tools, partition into domain groups (file ops, web ops, code ops, agent ops). Run parallel selectors, collect union, run final eliticism pass. Net: better recall, lower context per selector call.

**P2.2 Pluggable Executor Architecture** (ADR-047)
Model `createAgentLoop()` executor on Agentica's `IAgenticaExecutor` interface. Each step (initialize, select, call, describe) is replaceable. Default implementations as pure functions. Enables testing with mock executors and production customization.

**P2.3 Snapshot Recovery** (ADR-033)
Implement `task_snapshot` for multi-step workflows: serialize completed nodes, pending nodes, tool results to a POJO. Enable `resumeFromSnapshot(snapshot)` in the agent loop. Minimum MVP: serialize to localStorage for browser agents.

**P2.4 JudgeAgent Evaluation** (ADR-050)
Add `JudgeAgent` capability: an LLM evaluator that runs after each agent response and scores against a rubric. Surface scores in the `AgentEvent` stream for observability. Enables early termination when success criteria are met.

### Priority 3 — Medium Impact, High Complexity

**P3.1 Code-as-Actions Mode** (ADR-026)
Add `mode: "code"` to `createAgentLoop()`. When active, the LLM generates sandboxed JS/TS instead of JSON tool calls. Executor options: Node `vm` module (unsafe, dev-only), `node:worker_threads` with frozen globals (moderate), E2B (cloud). Reduces API calls by ~30% for data-heavy tasks.

**P3.2 DAG Workflow Execution** (ADR-033)
Full Eko-style XML workflow planning + DAG executor with pause/resume. Required for long-horizon autonomous tasks. High complexity: streaming XML parser, DAG topological sort, snapshot serialization.

**P3.3 Dual-Level Planning** (ADR-029)
Two-level planning: global task plan (produced once) + per-step sub-plan (produced before each step). OctoTools pattern. Requires model with strong instruction following. Reduces hallucination on multi-step tasks by maintaining task-level context at each step.

**P3.4 Multi-Agent Debate with Consensus** (ADR-043)
For high-stakes decisions (architecture choices, security reviews), spawn N agents with different system prompts (advocate, critic, neutral), aggregate responses with confidence weighting. Highest complexity but highest quality ceiling.

---

## 11. New ADRs (ADR-026 through ADR-050)

See `agentsy-prd-notes.md` §2 for full ADR entries.

| ADR     | Title                                                 | Priority | Source         |
| ------- | ----------------------------------------------------- | -------- | -------------- |
| ADR-026 | Code-as-Actions Execution Mode                        | P3       | SRC-11         |
| ADR-027 | Skill Progressive Loading                             | P2       | SRC-12         |
| ADR-028 | Tool Card Metadata Schema                             | P2       | SRC-16         |
| ADR-029 | Dual-Level Planning                                   | P3       | SRC-16         |
| ADR-030 | Compiler-Driven Function Schema                       | P1       | SRC-17         |
| ADR-031 | Validation Feedback Loop for Tool Arguments           | P1       | SRC-17         |
| ADR-032 | Parallel Divided Selection with Eliticism             | P2       | SRC-17         |
| ADR-033 | DAG-Based Parallel Task Execution + Snapshot Recovery | P2/P3    | SRC-15         |
| ADR-034 | A2A Protocol Support                                  | P3       | SRC-15, SRC-21 |
| ADR-035 | White-Box Editable Memory                             | P2       | SRC-20         |
| ADR-036 | Branching Conversation Trees                          | P3       | SRC-20         |
| ADR-037 | Sprint Lifecycle Skills Architecture                  | P2       | SRC-26         |
| ADR-038 | Continuous Checkpoint Mode with WIP Commits           | P2       | SRC-26         |
| ADR-039 | Simulation-Based Agent Testing                        | P1       | SRC-27         |
| ADR-040 | pass^k Consistency Metric for Agent Testing           | P1       | SRC-28         |
| ADR-041 | Crescendo Multi-Turn Red Team Testing                 | P2       | SRC-27         |
| ADR-042 | RSI Feedback Ledger                                   | P3       | SRC-21         |
| ADR-043 | Multi-Agent Debate with Confidence-Weighted Consensus | P3       | SRC-21         |
| ADR-044 | Shared Memory MCP for Multi-Agent Token Efficiency    | P2       | SRC-24         |
| ADR-045 | Evaluator-Optimizer Workflow Pattern                  | P2       | SRC-23         |
| ADR-046 | State Dict Cross-Step Data Passing                    | P1       | SRC-11         |
| ADR-047 | Pluggable Executor Architecture                       | P2       | SRC-17         |
| ADR-048 | 12-Factor Agent Design Principles                     | P1       | SRC-25         |
| ADR-049 | Design Taste Memory                                   | P3       | SRC-26         |
| ADR-050 | LLM-as-Judge at Every Turn                            | P1       | SRC-27         |
| ADR-051 | Team-Scoped Memory Bank Boundary Model                | P2       | SRC-29         |
| ADR-052 | Hybrid Memory Retention (user+project+team)           | P2       | SRC-29, SRC-24 |

---

## 12. New REQs (REQ-043 through REQ-065)

See `agentsy-platform-v2.md` §1 for full requirement entries.

| REQ     | Description                                                                              | ADR     | Priority |
| ------- | ---------------------------------------------------------------------------------------- | ------- | -------- |
| REQ-043 | Agent loop MUST support code-as-actions execution with sandboxed JS executor             | ADR-026 | P3       |
| REQ-044 | Agent loop MUST support configurable executor backends (local, Docker, E2B, WASM)        | ADR-026 | P3       |
| REQ-045 | Tool definitions SHOULD support progressive loading from markdown/TOML files             | ADR-027 | P2       |
| REQ-046 | Tool metadata MUST include capability description, input schema, output schema, version  | ADR-028 | P2       |
| REQ-047 | Agent MUST support dual-level planning (global task plan + per-step sub-plan)            | ADR-029 | P3       |
| REQ-048 | Function schemas MUST be compiler-generated from TypeScript types (typia or zod)         | ADR-030 | P1       |
| REQ-049 | Invalid tool arguments MUST trigger validation feedback loop with structured error retry | ADR-031 | P1       |
| REQ-050 | Selector MUST support parallel divided selection with eliticism for registries >50 tools | ADR-032 | P2       |
| REQ-051 | Workflow executor MUST support DAG-based parallel task execution                         | ADR-033 | P2       |
| REQ-052 | Workflow MUST support pause/resume with snapshot serialization                           | ADR-033 | P2       |
| REQ-053 | A2A Protocol MUST be supported for agent-to-agent communication                          | ADR-034 | P3       |
| REQ-054 | Memory MUST support white-box user editing without restart                               | ADR-035 | P2       |
| REQ-055 | Conversation history MUST support branching tree structure                               | ADR-036 | P3       |
| REQ-056 | Agent loop executor MUST be fully pluggable via IAgenticaExecutor-style interface        | ADR-047 | P2       |
| REQ-057 | Test harness MUST support UserSimulatorAgent + JudgeAgent scenario testing               | ADR-039 | P1       |
| REQ-058 | Test harness MUST report pass^k metric for all agent scenario tests                      | ADR-040 | P1       |
| REQ-059 | Test harness MUST support Crescendo-style multi-turn adversarial red team testing        | ADR-041 | P2       |
| REQ-060 | Agent architecture MUST follow 12-factor agent design principles                         | ADR-048 | P1       |
| REQ-061 | Cross-step binary/large object passing MUST use state dict key reference pattern         | ADR-046 | P1       |
| REQ-062 | Multi-agent context sharing MUST use compression + delta updates for token efficiency    | ADR-044 | P2       |
| REQ-063 | Agent loop SHOULD implement evaluator-optimizer sub-pattern for quality-sensitive tasks  | ADR-045 | P2       |
| REQ-064 | Agent loop MUST implement RSI feedback ledger tracking tool execution outcomes           | ADR-042 | P3       |
| REQ-065 | Sprint lifecycle actions SHOULD be expressible as named skill files in a skill directory | ADR-037 | P2       |
| REQ-066 | Memory MUST support team-scoped bank as a distinct tier alongside session/project/global | ADR-051 | P2       |
| REQ-067 | MemoryScope MUST enumerate: session, user, project, team, global; retain multi-scope     | ADR-051 | P2       |
| REQ-068 | Team-scoped banks MUST require explicit trust model before cross-agent data flows        | ADR-052 | P1       |
| REQ-069 | Retention into shared banks MUST be selective via `retentionTag` whitelist               | ADR-052 | P2       |
| REQ-070 | Team bank retrieval MUST support semantic+BM25+graph+temporal strategies via RRF         | ADR-052 | P2       |

---

## 13. Related Specifications / Further Reading

- [smolagents agents.py](https://github.com/huggingface/smolagents/blob/main/src/smolagents/agents.py)
- [Agentica execute.ts](https://github.com/wrtnlabs/agentica/blob/main/packages/core/src/orchestrate/execute.ts)
- [Agentica select.ts](https://github.com/wrtnlabs/agentica/blob/main/packages/core/src/orchestrate/select.ts)
- [Eko plan.ts](https://github.com/FellouAI/eko/blob/main/packages/eko-core/src/agent/plan.ts)
- [Eko chain.ts](https://github.com/FellouAI/eko/blob/main/packages/eko-core/src/agent/chain.ts)
- [gstack README](https://github.com/garrytan/gstack)
- **SRC-29**: [Hindsight — Building Multi-Agent Systems with Shared Memory](https://hindsight.vectorize.io/guides/2026/04/21/guide-building-multi-agent-systems-with-shared-memory) — bank boundary model (user/project/team/hybrid), retention discipline, multi-strategy recall (semantic+BM25+graph+temporal+RRF), common mistakes
- [langwatch/scenario README](https://github.com/langwatch/scenario)
- [awesome-ai-agent-testing](https://github.com/chaosync-org/awesome-ai-agent-testing)
- [agenticloops-ai/agentic-ai-engineering](https://github.com/agenticloops-ai/agentic-ai-engineering)
- [adolfousier/opencrabs](https://github.com/adolfousier/opencrabs)
- [Anthropic "Building Effective Agents"](https://www.anthropic.com/engineering/building-effective-agents)
