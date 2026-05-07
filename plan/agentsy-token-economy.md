# Plan: Token Economy and Context Reduction for Agentsy

## 1. Background Analysis

### Reviewed Resources Summary

- **Caveman / lithic token compression**
  Demonstrates that output token reduction can be achieved by constraining prose style, removing hedging, and keeping technical accuracy intact.

- **Dynamic toolsets and semantic tool selection**
  Shows that sending fewer tools to the model is one of the highest-impact ways to reduce input tokens in agentic workflows.

- **Prompt compression, summarization, and context engineering**
  Repeatedly shows that long-running agents need persistent context management, not just one-off truncation.

- **Semantic caching and retrieval filtering**
  Demonstrates that repeated prompts, repeated tool choices, and repeated retrievals are ideal candidates for caching and preselection.

### Key Takeaways

- Token reduction should be treated as a **policy system**, not a single formatter.
- Input-side savings and output-side savings are different problems and should use different mechanisms.
- Long-running agentic flows need **compression with memory continuity**, not simple message deletion.
- Tool discovery should be **semantic and incremental**, not “dump all schemas at once.”
- Output shortening should preserve technical meaning and be opt-in for stylistic compression modes.
- Observability is mandatory because token reduction that harms correctness is not a win.

---

## 2. Requirements for Agentsy Token Economy Support

Based on the research and the current Agentsy architecture, we need:

- **Input budget control**: enforce per-turn and per-session token budgets.
- **Output budget control**: set response length targets and output caps.
- **Context reduction**: trim, summarize, and prioritize what enters the prompt.
- **Toolset reduction**: expose only relevant tools and schemas for the current task.
- **Retrieval reduction**: filter retrieved documents and prune low-value passages.
- **Session memory compression**: persist summaries instead of keeping every raw turn forever.
- **Caching**: reuse exact or semantically similar prompts, tool selections, summaries, and retrievals.
- **Style presets**: allow terse / caveman-like outputs for human-facing responses without affecting machine-readable outputs.
- **Quality safeguards**: monitor whether compression changes accuracy, tool success, or completion quality.

---

## 3. Proposed Architecture

### 3.1 New Package: `@agentsy/token-economy`

Create a package dedicated to token reduction and context budgeting across agentic flows:

- **Core abstractions**:
  - `TokenBudget`
  - `TokenBudgetPolicy`
  - `ContextReducer`
  - `OutputReducer`
  - `ToolsetSelector`
  - `Summarizer`
  - `CacheAdapter`
  - `CompressionPlan`
  - `TokenMetrics`

- **Primary responsibilities**:
  - estimate token cost before execution
  - reduce context before the model sees it
  - compress conversation state during long sessions
  - shorten outputs when the surface allows it
  - keep machine-readable payloads lossless
  - surface metrics for quality and savings tracking

### 3.2 Inbound Reduction Pipeline

The inbound path should run before prompt assembly:

1. **Budget analysis**
   - estimate available token headroom
   - classify the turn as retrieval-heavy, tool-heavy, or dialogue-heavy

2. **Context selection**
   - keep recent turns
   - keep pinned instructions
   - keep task-critical artifacts
   - drop low-value chatter and redundant state

3. **Toolset selection**
   - expose only relevant tools
   - prefer semantic selection over static all-tools payloads
   - cache tool-selection results when appropriate

### 3.3 Outbound Reduction Pipeline

The outbound path should run after the model response is generated or while it is being streamed:

1. **Response shaping**
   - keep code, schemas, diffs, and machine-readable payloads intact
   - shorten prose responses when a shorter contract is acceptable
   - preserve exactness for commands, identifiers, and structured data

2. **Style control**
   - support terse natural-language presets
   - support a caveman-like preset for casual human-facing replies
   - support domain-specific presets such as review notes, commit messages, and status updates

3. **Length enforcement**
   - apply soft targets for concise responses
   - apply hard caps where the use case demands it
   - stop early when the user or surface explicitly requests brevity

### 3.4 Caching and Memory Layer

Token economy support should not re-solve the same compression problem repeatedly:

- **Exact cache**: reuse identical prompt, tool, and retrieval combinations.
- **Semantic cache**: reuse similar requests when the meaning is sufficiently close.
- **Session summary cache**: store compressed state for long-running conversations.
- **Tool-choice cache**: remember which tool subsets worked for similar tasks.
- **Retrieval cache**: remember which context slices were useful for a given intent.
- **Memory-backed summaries**: treat durable summaries as memory artifacts, not ephemeral prompt leftovers.

Token economy should **request** compressed memory state and **budget** it, while `@agentsy/memory` remains the source of truth for durable knowledge, scope, and provenance.

### 3.5 Observability and Evaluation

This module should expose metrics that prove the savings and catch regressions:

- input tokens before and after reduction
- output tokens before and after reduction
- total token savings per turn and per session
- compression ratio per reducer
- cache hit rate by strategy
- latency impact
- task-success impact
- user-visible quality regressions

---

## 4. Proposed Package Shape

### `@agentsy/token-economy`

This package should be the main public entry point.

#### Responsibilities

- token budgeting
- context reduction
- toolset selection
- prompt and response shaping
- summary persistence
- cache integration
- metrics and reporting

#### Suggested API surface

- `createTokenEconomy(...)`
- `createTokenBudgetPolicy(...)`
- `createContextReducer(...)`
- `createOutputReducer(...)`
- `createToolsetSelector(...)`
- `createSummarizer(...)`
- `createTokenCache(...)`
- `measureTokenUsage(...)`
- `planCompression(...)`

### Internal helper modules

- `budget.ts` for budget rules and thresholds
- `reducers.ts` for inbound and outbound reducers
- `summarization.ts` for session compression and recursive summary logic
- `tool-selection.ts` for semantic tool narrowing
- `cache.ts` for cache adapters
- `metrics.ts` for savings and quality telemetry
- `presets.ts` for style presets such as terse, review, commit, and caveman

---

## 5. Integration With Existing Agentsy Packages

This module should fit into the current framework without breaking existing package boundaries:

- `@agentsy/processor`
  - apply context and output reducers around stream processing
- `@agentsy/structured`
  - preserve structured output contracts and validate compressed data paths
- `@agentsy/tool-calls`
  - reduce tool schema payloads and preserve tool-call integrity
- `@agentsy/recovery`
  - persist and restore compressed session state
- `@agentsy/normalizers`
  - keep provider-specific token and message shapes normalized before reduction
- `@agentsy/renderers`
  - apply output style presets only where rendering is human-facing
- `@agentsy/ui` and `@agentsy/ag-ui`
  - surface savings and session-summary state in UI layers if needed
- `@agentsy/memory`
  - source durable summaries and retrieval state instead of duplicating long-term storage
  - treat memory as a pluggable backend, not a mandatory dependency for all consumers

### Modular deployment rule

- `@agentsy/token-economy` must remain useful even when a consumer brings their own memory system.
- Memory integration should happen through abstract interfaces and optional adapters, not hard-coded storage assumptions.
- The package should work in pure Agentsy mode, but also as a standalone optimization layer for external stacks.

## 6. Implementation Plan

### Phase 1: Core abstractions and budgets

1. Define token budget types and policy presets.
2. Implement measurement helpers for input and output token counts.
3. Add reducer interfaces for context, output, and toolsets.
4. Add tests for budget enforcement and basic reduction behavior.

### Phase 2: Inbound reduction pipeline

1. Implement context selection and trimming.
2. Implement semantic toolset selection.
3. Add retrieval filtering and passage pruning.
4. Add tests for long-context, tool-heavy, and retrieval-heavy flows.

### Phase 3: Outbound reduction pipeline

1. Implement concise response shaping.
2. Implement style presets, including a caveman-like preset.
3. Add hard and soft length constraints.
4. Ensure code and structured outputs are preserved losslessly.

### Phase 4: Summarization and memory compression

1. Implement session summary persistence.
2. Add recursive summarization fallback when summaries still exceed budget.
3. Add cache-aware compression rules for repeated turns.
4. Add tests for resumable sessions and summary continuity.

### Phase 5: Caching and observability

1. Add exact and semantic cache adapters.
2. Record compression ratios and savings metrics.
3. Expose instrumentation for latency and quality regression monitoring.
4. Add integration tests that verify savings without breaking task correctness.

### Phase 6: Package integration

1. Wire the module into processor and renderer flows.
2. Keep output presets off machine-readable paths.
3. Expose package docs and examples.
4. Add migration guidance for existing agent flows.

---

## 7. Risk Mitigation & Best Practices

- Never compress code, JSON, or tool payloads in ways that change meaning.
- Keep caveman-like output modes opt-in.
- Do not rely on truncation alone for long-running flows.
- Prefer semantic selection over hardcoded heuristic trimming when tools or retrievals are involved.
- Measure quality, not just token counts.
- Cache carefully to avoid stale or misleading context reuse.
- Preserve deterministic summaries where possible so sessions can be resumed safely.

---

## 8. Summary

`@agentsy/token-economy` should provide a unified strategy layer for reducing tokens in and out of agentic flows.

It will combine:

- input budgeting
- context trimming
- semantic tool selection
- retrieval pruning
- session summarization
- output shaping
- style presets
- caching
- metrics

The main goal is to cut waste without damaging correctness, and to make token efficiency a first-class part of the Agentsy architecture rather than an afterthought.
