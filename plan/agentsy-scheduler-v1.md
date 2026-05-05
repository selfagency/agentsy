---
goal: '@agentsy/scheduler — agent-invokable task scheduling: natural language parsing, cron/one-shot/recurring tasks, persistent stores, MCP tool interface'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['feature', 'scheduler', 'cron', 'task-queue', 'agentsy']
---

# @agentsy Platform — Task Scheduler v1

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Implements a task scheduling system that agents can use to schedule deferred or recurring work. Inspired by [llm-scheduler](https://github.com/rebase-ai/llm-scheduler)'s natural-language-first approach and the resource-aware task partitioning concepts from ScheInfer (arXiv:2411.15715).

**What this plan provides:**

- `@agentsy/scheduler` package — deterministic scheduler core (no LLM dependency)
- `ScheduleParser` — LLM-assisted natural language → structured schedule extraction
- `TaskStore` interface with `InMemoryTaskStore` (default) and `FileTaskStore` (persistent)
- `AgentTaskRunner` — executes scheduled tasks as `createAgentLoop` invocations
- `createSchedulerTools` — MCP-compatible tools agents call to register/cancel/list tasks
- Slash commands: `/schedule`, `/tasks`, `/cancel-task`

**What this plan does NOT cover:**

- External backends (Celery, Kubernetes CronJob, Redis) — deferred to v2
- Browser/client-side scheduling
- Inference-layer parallelism (ScheInfer's CPU/GPU domain is out of scope)

Cross-references: `agentsy-features-v1.md` (Phase 5 slash commands, Phase 8 connectors), `agentsy-connectors-v1.md` (delivery of scheduled task output), `agentsy-agents-v1.md` (agent loop integration).

---

## 1. Requirements & Constraints

- **REQ-091**: `TaskScheduler` MUST support three task types: `once` (run at a specific future datetime), `recurring` (cron expression or human interval, repeats indefinitely or up to `maxRuns`), and `immediate` (enqueue for next available execution slot, no delay).
- **REQ-092**: `ScheduleParser` MUST convert natural language schedule strings to `ParsedSchedule` using a structured extraction prompt with JSON schema validation. It MUST NOT use free-form LLM generation for the final schedule — output MUST be schema-validated before acceptance.
- **REQ-093**: `TaskScheduler.schedule(task)` MUST return a `TaskHandle { taskId, nextRunAt, cronExpression? }`. Task IDs MUST be stable, deterministic UUIDs derived from `taskName + ownerId + scheduleSignature` to prevent duplicate scheduling.
- **REQ-094**: Scheduled tasks MUST be persisted to `TaskStore` before `schedule()` returns. If the process restarts, `TaskScheduler.restore()` MUST reload all pending tasks from the store and re-register them with the in-process scheduler.
- **REQ-095**: `AgentTaskRunner` MUST execute each scheduled task as an isolated `createAgentLoop` invocation with a fresh context derived from the task's stored `prompt` and optional `sessionContext`. It MUST NOT reuse the scheduling agent's session.
- **REQ-096**: Each task execution MUST have a configurable `timeout` (default: 5 minutes). On timeout, the runner emits `TaskTimeout` event, marks the task run as `'failed'`, increments `failureCount`. After `maxRetries` (default: 3) consecutive failures the task is suspended and `TaskSuspended` event is emitted.
- **REQ-097**: `createSchedulerTools` MUST return three MCP-compatible tool specs: `schedule_task`, `cancel_task`, `list_tasks`. These integrate with `@agentsy/mcp`'s `MCPOrchestrator` via `registerLocalTools`.
- **REQ-098**: `FileTaskStore` MUST serialize tasks to `~/.agentsy/tasks/<taskId>.json` (one file per task). Path MUST be configurable via `AGENTSY_TASK_STORE_PATH` env var or `TaskStoreOptions.path`. Concurrent writes MUST use file locking to prevent corruption.
- **REQ-099**: `/schedule`, `/tasks`, and `/cancel-task` slash commands MUST be added to `@agentsy/slash-commands` package as stock SKILL.md files invoking the scheduler tools.
- **REQ-100**: Task output MAY be delivered back to the originating channel via `@agentsy/connectors` when `task.deliveryChannel` is set. The `AgentTaskRunner` passes the result text to the registered `ChannelAdapter.send()` for that channel.
- **REQ-105**: `TaskScheduler` MUST implement an Agent Circuit Breaker: after `circuitBreakerThreshold` (default: 5) consecutive task failures across all tasks within a sliding `circuitBreakerWindow` (default: 10 minutes), the scheduler MUST pause all new task executions and emit `SchedulerCircuitOpen` event. Manual reset via `scheduler.resetCircuit()`.
- **REQ-106**: Scheduled task execution order within the same time slot MUST be determined by a Lane-Based Execution Queue: tasks are assigned a `lane` property (default: `'default'`), and each lane has a configurable `concurrency` limit (default: 1). Lanes prevent one high-frequency task from starving others.
- **REQ-107**: When a scheduled task's `AgentTaskRunner` produces output and `task.deliveryChannel` is set, the delivery MUST implement Seamless Background-to-Foreground Handoff: if the originating session is currently active, the result is injected as a proactive message; if inactive, it is queued and delivered on next session resume.
- **SEC-022**: Task `prompt` content stored in `TaskStore` MUST be treated as untrusted at execution time. Before injecting into agent context, it MUST pass through `stripXmlContextTags` + `dedupeXmlContext` (same pipeline as inbound connector messages, SEC-013).
- **SEC-023**: `ScheduleParser`'s LLM call MUST have a hard `maxTokens: 200` cap. Output MUST be parsed as JSON against `ParsedScheduleSchema` (Zod). Any schema validation failure MUST reject the parse — never fall back to raw LLM text.
- **SEC-024**: `schedule_task` tool MUST validate that `cronExpression` (if provided directly) matches `/^[\d*,\-\/\s]+$/` before passing to the cron library. Reject with `InvalidCronExpression` error. This prevents cron injection.
- **SEC-025**: `FileTaskStore` paths MUST be sanitized with `path.resolve` and validated to be within `AGENTSY_TASK_STORE_PATH` before any read/write. Reject traversal paths (SEC prevents path traversal — OWASP A01).
- **SEC-027**: `AgentTaskRunner` MUST enforce the Lethal Trifecta principle. Scheduled task agents MUST have: (1) no direct access to cross-user session data, (2) all task prompts sanitized before injection (SEC-022), and (3) network egress restricted to explicitly allow-listed domains if `egressAllowList` is configured.
- **CON-019**: `@agentsy/scheduler` MUST NOT hard-depend on any LLM SDK. `ScheduleParser` takes a `ModelClient` interface (from `@agentsy/core`) as a constructor argument — the LLM provider is injected, not imported.
- **CON-020**: The in-process scheduler MUST use `node-schedule@^2` (peerDep). It MUST be the only cron execution engine in v1. External backends (Redis, Celery) are out of scope.
- **CON-021**: Task IDs MUST be UUID v5 (deterministic, name-based) using the task's canonical fingerprint. This ensures idempotent scheduling — calling `schedule_task` twice with identical params schedules exactly one task.
- **CON-022**: `TaskScheduler` MUST be a plain class (not a singleton). Consumers can instantiate multiple schedulers (e.g., one per user or one per channel). Each instance manages its own store and runner.

---

## 2. Implementation Steps

### Phase TS1 — Core Types + Package Scaffold

- **GOAL-TS1**: Define all types, create `packages/scheduler/`, and wire into turbo/pnpm workspace.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                     | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TS1-001 | Create `packages/scheduler/`. Add `package.json` (`@agentsy/scheduler`, peerDeps: `@agentsy/core@workspace:*`, `node-schedule@^2`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`. Add to `pnpm-workspace.yaml` and `turbo.json`.                                                                                                                                       |           |      |
| TASK-TS1-002 | Define `ParsedSchedule` in `packages/scheduler/src/types.ts`: `{ type: 'once' \| 'recurring' \| 'immediate', runAt?: Date, cronExpression?: string, intervalMs?: number, maxRuns?: number, timezone?: string }`. Export `ParsedScheduleSchema` as Zod schema for validation.                                                                                                    |           |      |
| TASK-TS1-003 | Define `ScheduledTask` in `packages/scheduler/src/types.ts`: `{ taskId: string, taskName: string, ownerId: string, prompt: string, sessionContext?: Record<string, unknown>, schedule: ParsedSchedule, deliveryChannel?: string, timeout?: number, maxRetries?: number, createdAt: number, status: TaskStatus, failureCount: number, lastRunAt?: number, nextRunAt?: number }`. |           |      |
| TASK-TS1-004 | Define `TaskStatus` union: `'pending' \| 'running' \| 'completed' \| 'failed' \| 'suspended' \| 'cancelled'`. Define `TaskHandle { taskId: string, nextRunAt?: Date, cronExpression?: string }`. Define `TaskRunResult { taskId: string, runAt: number, output: string, status: 'completed' \| 'failed', durationMs: number }`.                                                 |           |      |
| TASK-TS1-005 | Define `TaskStore` interface in `packages/scheduler/src/store.ts`: `save(task: ScheduledTask): Promise<void>`, `load(taskId: string): Promise<ScheduledTask \| null>`, `loadAll(): Promise<ScheduledTask[]>`, `update(taskId: string, patch: Partial<ScheduledTask>): Promise<void>`, `delete(taskId: string): Promise<void>`.                                                  |           |      |
| TASK-TS1-006 | Define `ModelClient` interface shim in `packages/scheduler/src/types.ts` (mirrors `@agentsy/core`'s existing interface): `{ complete(messages: Message[], options?: CompletionOptions): Promise<string> }`. Used by `ScheduleParser` constructor injection (CON-019).                                                                                                           |           |      |

### Phase TS2 — ScheduleParser + TaskScheduler

- **GOAL-TS2**: Implement natural language schedule parsing and the core `TaskScheduler`.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                     | Completed | Date |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TS2-001 | Implement `ScheduleParser` in `packages/scheduler/src/parser.ts`. Constructor: `(client: ModelClient)`. Method: `async parse(input: string, timezone?: string): Promise<ParsedSchedule>`. Sends a single-turn prompt to the model with the `SCHEDULE_PARSE_PROMPT` system message and `maxTokens: 200` cap (SEC-023).                                           |           |      |
| TASK-TS2-002 | Write `SCHEDULE_PARSE_PROMPT` constant in `packages/scheduler/src/parser.ts`. The prompt instructs the model to extract a `ParsedSchedule` JSON object from the input, providing the schema and examples. Includes explicit instruction: "Output ONLY valid JSON matching the schema. No explanation."                                                          |           |      |
| TASK-TS2-003 | Implement JSON extraction + Zod validation in `ScheduleParser.parse()`: extract first JSON object from model response with regex `/\{[\s\S]*\}/`, parse with `JSON.parse`, validate with `ParsedScheduleSchema.safeParse`. On failure throw `ScheduleParseError { input, rawResponse }` (SEC-023 — never fall back to raw text).                                |           |      |
| TASK-TS2-004 | Implement `computeTaskId(taskName: string, ownerId: string, schedule: ParsedSchedule): string` in `packages/scheduler/src/task-id.ts`. Uses UUID v5 with namespace `AGENTSY_SCHEDULER_NS` (fixed UUID constant) over `JSON.stringify({ taskName, ownerId, schedule })`. Ensures idempotent scheduling (CON-021).                                                |           |      |
| TASK-TS2-005 | Implement `TaskScheduler` class in `packages/scheduler/src/scheduler.ts`. Constructor: `(store: TaskStore, runner: AgentTaskRunner, options?: { timezone?: string })`. Methods: `schedule(input: ScheduleInput): Promise<TaskHandle>`, `cancel(taskId: string): Promise<void>`, `list(ownerId?: string): Promise<ScheduledTask[]>`, `restore(): Promise<void>`. |           |      |
| TASK-TS2-006 | Implement `TaskScheduler.schedule()`: (1) validate and normalize `ScheduleInput`; (2) compute `taskId` via `computeTaskId`; (3) check for existing task with same ID in store — return existing `TaskHandle` if found (idempotency, CON-021); (4) persist to store; (5) register with `node-schedule`; (6) return `TaskHandle`.                                 |           |      |
| TASK-TS2-007 | Implement `TaskScheduler.restore()`: call `store.loadAll()`, filter to `status: 'pending' \| 'running'`, re-register each with `node-schedule`. Tasks with `nextRunAt` in the past are either skipped (for `once`) or re-scheduled at next cron occurrence (for `recurring`). Emit `TaskRestored` event per task.                                               |           |      |
| TASK-TS2-008 | Implement `TaskScheduler.cancel()`: unregister from `node-schedule`, call `store.update(taskId, { status: 'cancelled' })`, emit `TaskCancelled` event. If task not found, throw `TaskNotFoundError`.                                                                                                                                                            |           |      |
| TASK-TS2-009 | Implement `createTaskScheduler(options: CreateSchedulerOptions): TaskScheduler` factory in `packages/scheduler/src/index.ts`. `CreateSchedulerOptions`: `{ store?: TaskStore, runner: AgentTaskRunner, timezone?: string }`. Defaults: `store = new InMemoryTaskStore()`.                                                                                       |           |      |

### Phase TS3 — TaskStore Implementations + AgentTaskRunner

- **GOAL-TS3**: Ship `InMemoryTaskStore`, `FileTaskStore`, and `AgentTaskRunner`.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                                                     | Completed | Date |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TS3-001 | Implement `InMemoryTaskStore` in `packages/scheduler/src/stores/memory.ts`. Implements `TaskStore` using `Map<string, ScheduledTask>`. No persistence — suitable for tests and ephemeral schedulers.                                                                                                                                                                                                            |           |      |
| TASK-TS3-002 | Implement `FileTaskStore` in `packages/scheduler/src/stores/file.ts`. Constructor: `(options: { path?: string })`. Path defaults to `process.env.AGENTSY_TASK_STORE_PATH ?? path.join(os.homedir(), '.agentsy', 'tasks')`. Validate path is within configured base to prevent traversal (SEC-025).                                                                                                              |           |      |
| TASK-TS3-003 | Implement file locking in `FileTaskStore` using `proper-lockfile@^4` (peerDep). `save()`, `update()`, `delete()` acquire exclusive lock on `<path>/<taskId>.lock` before writing. `loadAll()` reads concurrently without locks (read-only). (REQ-098, prevents corruption on concurrent writes.)                                                                                                                |           |      |
| TASK-TS3-004 | Implement `FileTaskStore.save()`: sanitize path (SEC-025), serialize task to JSON, write to `<path>/<taskId>.json` atomically via write-to-temp + rename.                                                                                                                                                                                                                                                       |           |      |
| TASK-TS3-005 | Define `AgentTaskRunner` interface in `packages/scheduler/src/runner.ts`: `{ run(task: ScheduledTask): Promise<TaskRunResult> }`. Export `CreateRunnerOptions { createLoop: typeof createAgentLoop, timeout?: number }`.                                                                                                                                                                                        |           |      |
| TASK-TS3-006 | Implement `createAgentTaskRunner(options: CreateRunnerOptions): AgentTaskRunner` factory. `run(task)`: (1) sanitize `task.prompt` via `stripXmlContextTags` + `dedupeXmlContext` (SEC-022); (2) call `options.createLoop({ systemPrompt: task.prompt, sessionContext: task.sessionContext })`; (3) enforce `timeout` via `Promise.race`; (4) on timeout emit `TaskTimeout`, return `{ status: 'failed', ... }`. |           |      |
| TASK-TS3-007 | Wire `AgentTaskRunner` into `TaskScheduler`: on each `node-schedule` job fire, call `store.update(taskId, { status: 'running' })`, call `runner.run(task)`, then `store.update(taskId, { status: result.status, lastRunAt: Date.now(), failureCount: ... })`. After `maxRetries` failures, set `status: 'suspended'`, emit `TaskSuspended`.                                                                     |           |      |
| TASK-TS3-008 | Implement delivery in `AgentTaskRunner.run()`: after successful run, if `task.deliveryChannel` is set, call `deliveryAdapter.send({ channelId: task.deliveryChannel, userId: task.ownerId, text: result.output })`. The `deliveryAdapter` is injected via `CreateRunnerOptions.deliveryAdapter?: ChannelAdapter<unknown>`.                                                                                      |           |      |

### Phase TS4 — MCP Tools + Slash Commands + Tests

- **GOAL-TS4**: Expose scheduler capabilities as MCP tools and slash commands, and achieve full test coverage.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Completed | Date |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TS4-001 | Implement `createSchedulerTools(scheduler: TaskScheduler, parser: ScheduleParser)` in `packages/scheduler/src/tools.ts`. Returns array of three `LocalToolSpec` objects for `@agentsy/mcp`'s `registerLocalTools`.                                                                                                                                                                                                                                                               |           |      |
| TASK-TS4-002 | Define `schedule_task` tool spec: input schema `{ name: string, prompt: string, when: string, ownerId?: string, maxRuns?: number, deliveryChannel?: string }`. Handler: calls `parser.parse(when)`, then `scheduler.schedule(...)`. Returns `TaskHandle` serialized to text. Validate `cronExpression` with `/^[\d*,\-\/\s]+$/` if provided (SEC-024).                                                                                                                           |           |      |
| TASK-TS4-003 | Define `cancel_task` tool spec: input schema `{ taskId: string }`. Handler: calls `scheduler.cancel(taskId)`. Returns confirmation text.                                                                                                                                                                                                                                                                                                                                         |           |      |
| TASK-TS4-004 | Define `list_tasks` tool spec: input schema `{ ownerId?: string, status?: TaskStatus }`. Handler: calls `scheduler.list(ownerId)`, filters by status if given, returns formatted table of tasks with `taskId`, `taskName`, `nextRunAt`, `status`.                                                                                                                                                                                                                                |           |      |
| TASK-TS4-005 | Add `schedule` SKILL.md to `packages/slash-commands/src/skills/schedule.md` (REQ-099). Frontmatter: `description`, `argument-hint: '<what to do> <when>'`. Body: instructs agent to call `schedule_task` tool with user's natural language.                                                                                                                                                                                                                                      |           |      |
| TASK-TS4-006 | Add `tasks` and `cancel-task` SKILL.md files to `packages/slash-commands/src/skills/` (REQ-099). `/tasks.md` calls `list_tasks`. `/cancel-task.md` calls `cancel_task $1`.                                                                                                                                                                                                                                                                                                       |           |      |
| TASK-TS4-007 | Export `TaskScheduler`, `ScheduleParser`, `createTaskScheduler`, `createSchedulerTools`, `createAgentTaskRunner`, `InMemoryTaskStore`, `FileTaskStore`, `TaskStore`, `ScheduledTask`, `ParsedSchedule`, `TaskHandle`, `TaskStatus` from `packages/scheduler/src/index.ts`.                                                                                                                                                                                                       |           |      |
| TASK-TS4-008 | Write `packages/scheduler/src/parser.test.ts`. Cases: valid "tomorrow at 9am" → `{ type: 'once', runAt: Date }` shape; valid "every Monday at 8am" → `{ type: 'recurring', cronExpression: '0 8 * * 1' }` shape; invalid JSON from model → throws `ScheduleParseError`; schema mismatch → throws (SEC-023). Mock `ModelClient`.                                                                                                                                                  |           |      |
| TASK-TS4-009 | Write `packages/scheduler/src/scheduler.test.ts`. Cases: `schedule()` returns `TaskHandle`; duplicate `schedule()` with same params returns same `taskId` (CON-021); `cancel()` updates status; `restore()` re-registers pending tasks; `list(ownerId)` filters correctly. Use `InMemoryTaskStore`.                                                                                                                                                                              |           |      |
| TASK-TS4-010 | Write `packages/scheduler/src/stores/file.test.ts`. Cases: `save` + `loadAll` round-trips; `update` patches fields; `delete` removes file; path traversal attempt `../../../etc/passwd` throws (SEC-025). Use temp dir via `os.tmpdir()`.                                                                                                                                                                                                                                        |           |      |
| TASK-TS4-011 | Write `packages/scheduler/src/runner.test.ts`. Cases: `run()` sanitizes prompt (SEC-022); timeout emits `TaskTimeout` and returns `'failed'`; successful run returns `'completed'` + output text; `deliveryChannel` set → `deliveryAdapter.send()` called with result. Mock `createAgentLoop`.                                                                                                                                                                                   |           |      |
| TASK-TS4-012 | Write `packages/scheduler/src/tools.test.ts`. Cases: `schedule_task` with valid natural language → returns taskId; `schedule_task` with invalid cron `; DROP TABLE` → throws `InvalidCronExpression` (SEC-024); `cancel_task` unknown ID → error text; `list_tasks` returns formatted output.                                                                                                                                                                                    |           |      |
| TASK-TS4-013 | Implement `AgentCircuitBreaker` in `packages/scheduler/src/circuit-breaker.ts`. Fields: `threshold: number`, `windowMs: number`, `failureCount: number`, `windowStart: number`, `state: 'closed' \| 'open'`. Method `record(outcome: 'success' \| 'failure')` updates count; `isOpen()` returns true when threshold exceeded within window. `TaskScheduler` calls `record()` after each run; skips execution and emits `SchedulerCircuitOpen` when `isOpen()` is true (REQ-105). |           |      |
| TASK-TS4-014 | Add `lane: string` (default `'default'`) and per-lane `concurrency: number` (default `1`) to `ScheduledTask`. Implement `LaneExecutionQueue` in `packages/scheduler/src/lane-queue.ts` tracking active task count per lane; blocks new executions when lane is at capacity; emits `LaneQueued` / `LaneDrained` events (REQ-106).                                                                                                                                                 |           |      |
| TASK-TS4-015 | Implement `BackgroundForegroundHandoff` in `packages/scheduler/src/handoff.ts`. Accept `sessionRegistry: SessionRegistry` (interface: `isActive(ownerId: string): boolean`, `onResume(ownerId: string, cb: () => void): void`). On task completion: if `isActive(task.ownerId)`, call `deliveryAdapter.send()` immediately; else enqueue in `PendingDeliveryStore`. On session resume, flush all pending deliveries (REQ-107).                                                   |           |      |

---

## 3. Alternatives

- **ALT-020**: Use an external task queue (Bull/BullMQ + Redis) as the only backend. Rejected for v1 — adds an infrastructure dependency for a feature that must work locally without Redis. In-process `node-schedule` is sufficient for v1; v2 can add BullMQ as an optional backend.
- **ALT-021**: Use `croner` instead of `node-schedule`. `croner` is more actively maintained and handles DST correctly. Could be substituted in v2 — the backend is abstracted behind `TaskScheduler`'s scheduling methods, making it swappable.
- **ALT-022**: Parse schedule expressions via regex only (no LLM). Rejected — regex cannot reliably handle "next Tuesday after the standup" or locale-specific natural language. The hybrid approach (LLM parse → Zod validate → deterministic schedule) is safer than pure regex and more flexible than pure determinism.
- **ALT-023**: Store tasks in SQLite instead of flat JSON files. SQLite is better for queries and concurrent access. Deferred to v2 as `SqliteTaskStore`. The `TaskStore` interface makes it a drop-in addition.
- **ALT-024**: Ship scheduler tools as a dedicated MCP server (stdio process) instead of local tools. Rejected for v1 — local tool registration is simpler and avoids the serialization overhead of stdio IPC for in-process scheduling. A standalone MCP server mode can be added in v2.

---

## 4. Dependencies

- **DEP-023**: `node-schedule@^2` — in-process cron/one-shot scheduler. `peerDependency` in `packages/scheduler/package.json`.
- **DEP-024**: `proper-lockfile@^4` — file locking for `FileTaskStore`. `peerDependency`.
- **DEP-025**: `zod@^3` — `ParsedScheduleSchema` validation (already used elsewhere in monorepo). `peerDependency`.
- **DEP-026**: `uuid@^9` — UUID v5 for deterministic task ID generation (CON-021). `peerDependency`.
- **DEP-027**: `@agentsy/core@workspace:*` — `ModelClient` interface + `stripXmlContextTags`/`dedupeXmlContext` utilities.
- **DEP-028**: `@agentsy/agent@workspace:*` — `createAgentLoop` (injected via `AgentTaskRunner` constructor, not hard-imported).

---

## 5. Files

- **FILE-039**: `packages/scheduler/` — new package (`@agentsy/scheduler`)
- **FILE-040**: `packages/scheduler/src/types.ts` — `ParsedSchedule`, `ParsedScheduleSchema`, `ScheduledTask`, `TaskStatus`, `TaskHandle`, `TaskRunResult`, `ModelClient` shim
- **FILE-041**: `packages/scheduler/src/parser.ts` — `ScheduleParser`, `SCHEDULE_PARSE_PROMPT`
- **FILE-042**: `packages/scheduler/src/task-id.ts` — `computeTaskId`
- **FILE-043**: `packages/scheduler/src/store.ts` — `TaskStore` interface
- **FILE-044**: `packages/scheduler/src/stores/memory.ts` — `InMemoryTaskStore`
- **FILE-045**: `packages/scheduler/src/stores/file.ts` — `FileTaskStore`
- **FILE-046**: `packages/scheduler/src/runner.ts` — `AgentTaskRunner`, `createAgentTaskRunner`
- **FILE-047**: `packages/scheduler/src/scheduler.ts` — `TaskScheduler`, `createTaskScheduler`
- **FILE-048**: `packages/scheduler/src/tools.ts` — `createSchedulerTools`
- **FILE-049**: `packages/scheduler/src/index.ts` — package barrel
- **FILE-050**: `packages/slash-commands/src/skills/schedule.md` — `/schedule` slash command
- **FILE-051**: `packages/slash-commands/src/skills/tasks.md` — `/tasks` slash command
- **FILE-052**: `packages/slash-commands/src/skills/cancel-task.md` — `/cancel-task` slash command
- **FILE-053**: `packages/scheduler/src/circuit-breaker.ts` — `AgentCircuitBreaker` (REQ-105)
- **FILE-054**: `packages/scheduler/src/lane-queue.ts` — `LaneExecutionQueue` (REQ-106)
- **FILE-055**: `packages/scheduler/src/handoff.ts` — `BackgroundForegroundHandoff` (REQ-107)

---

## 6. Testing

- **TEST-TS-001**: `parser.test.ts` — NL parsing cases, schema validation failures (SEC-023), model mock
- **TEST-TS-002**: `scheduler.test.ts` — schedule/cancel/list/restore lifecycle, idempotency (CON-021)
- **TEST-TS-003**: `stores/file.test.ts` — round-trip persistence, path traversal rejection (SEC-025)
- **TEST-TS-004**: `runner.test.ts` — prompt sanitization (SEC-022), timeout/retry, delivery channel
- **TEST-TS-005**: `tools.test.ts` — all three tool handlers, cron injection prevention (SEC-024)
- **TEST-TS-006**: `circuit-breaker.test.ts` — configure `threshold: 3`, `windowMs: 60000`; simulate 3 consecutive failures; assert `isOpen() === true`; call `resetCircuit()`; assert `isOpen() === false`; assert `SchedulerCircuitOpen` event emitted (REQ-105).
- **TEST-TS-007**: `lane-queue.test.ts` — set lane `concurrency: 1`; schedule 3 tasks on same lane; assert only 1 executes simultaneously; assert `LaneQueued` events for queued tasks; assert `LaneDrained` event after all complete (REQ-106).
- **TEST-TS-008**: `handoff.test.ts` — active session: assert `deliveryAdapter.send()` called immediately on completion; inactive session: assert delivery enqueued; assert `send()` called on `onResume()` trigger (REQ-107).

---

## 7. Risks & Assumptions

- **RISK-TS-001**: `node-schedule` tasks are in-process and lost on crash unless `FileTaskStore` + `restore()` is used. Mitigation: document that `FileTaskStore` is required for production; `InMemoryTaskStore` is for tests only. `restore()` MUST be called on startup.
- **RISK-TS-002**: LLM-based schedule parsing can be slow (adds latency to `schedule_task` tool call). Mitigation: `maxTokens: 200` minimizes latency; `ScheduleParser` also accepts a pre-parsed `ParsedSchedule` directly to bypass LLM when cron expression is already known.
- **RISK-TS-003**: Multiple `TaskScheduler` instances on the same `FileTaskStore` path can corrupt state. Mitigation: `proper-lockfile` prevents data corruption; however, consumers should use one `TaskScheduler` per store path.
- **ASSUMPTION-TS-001**: `@agentsy/core` exports `stripXmlContextTags` and `dedupeXmlContext` as public API before this plan is implemented.
- **ASSUMPTION-TS-002**: `@agentsy/mcp` `registerLocalTools` API is available (from `agentsy-features-v1.md`).
- **ASSUMPTION-TS-003**: `@agentsy/slash-commands` package exists (from `agentsy-features-v1.md` Phase 5).

---

## 8. Related Specifications / Further Reading

- [agentsy-features-v1.md](agentsy-features-v1.md) — Phase 5 (slash commands), Phase 8 (connectors + `ChannelAdapter`)
- [agentsy-connectors-v1.md](agentsy-connectors-v1.md) — `ChannelAdapter.send()` used for task output delivery (REQ-100)
- [agentsy-agents-v1.md](agentsy-agents-v1.md) — `createAgentLoop` is the execution vehicle for scheduled tasks
- [rebase-ai/llm-scheduler](https://github.com/rebase-ai/llm-scheduler) — natural language scheduling reference implementation
- [arXiv:2411.15715 — ScheInfer](https://arxiv.org/abs/2411.15715) — resource-aware task partitioning (informs timeout + retry model)
- [node-schedule](https://github.com/node-schedule/node-schedule) — in-process cron engine (DEP-023)
