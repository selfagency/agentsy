---
goal: @agentsy/testing production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: testing-maintainers
status: In progress
tags: [feature, architecture, testing, fixtures, e2e]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/testing` as shared quality infrastructure for package and system workflows.

## 1. Requirements & Constraints

- **REQ-TESTING-001**: Shared fixtures support providers/runtime/tools/orchestrator/memory/session integration tests.
- **REQ-TESTING-002**: Harness supports deterministic and probabilistic scenario modes.
- **REQ-TESTING-003**: E2E helpers support CLI and non-CLI surfaces with stable assertions.
- **REQ-TESTING-004**: Golden/snapshot outputs are versioned and documented.
- **REQ-TESTING-005**: Network-bound tests use MSW (`msw` v2) as the default request-interception layer in Node/browser test environments.
- **SEC-TESTING-001**: Test data is synthetic/scrubbed and free of real secrets.
- **SEC-TESTING-002**: Adversarial scenarios execute in isolated test boundaries.
- **CON-TESTING-001**: Package-specific business logic assertions stay in owning packages.
- **CON-TESTING-002**: Testing package exposes reusable primitives, not product runtime logic.
- **CON-TESTING-003**: Prefer MSW handlers over ad hoc fetch/axios monkeypatches for HTTP mocking; keep fixture/replay mocks for non-network deterministic stream simulation.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-TESTING-001: Harness contract stabilization.

| Task             | Description                                                                                                                         | Completed | Date |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TESTING-001 | Stabilize fixture, mock, and scenario runner contracts.                                                                             |           |      |
| TASK-TESTING-002 | Add typed tests for harness API compatibility and deterministic controls.                                                           |           |      |
| TASK-TESTING-003 | Document package ownership boundaries and usage guidance.                                                                           |           |      |
| TASK-TESTING-013 | Define shared MSW setup contracts (`setupServer`, lifecycle hooks, handler composition) for workspace-wide Node/browser test usage. |           |      |

### Implementation Phase 2

- GOAL-TESTING-002: Core testing infrastructure completion.

| Task             | Description                                                                                                                         | Completed | Date |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TESTING-004 | Implement shared mock providers/tools and scenario runner utilities.                                                                |           |      |
| TASK-TESTING-005 | Implement snapshot/golden management helpers and update workflow.                                                                   |           |      |
| TASK-TESTING-006 | Implement red-team/adversarial fixture sets and safety checks.                                                                      |           |      |
| TASK-TESTING-014 | Implement reusable MSW handler libraries for provider/model/memory/retrieval HTTP surfaces and document override patterns per test. |           |      |

### Implementation Phase 3

- GOAL-TESTING-003: Cross-package integration.

| Task             | Description                                                                                                                    | Completed | Date |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-TESTING-007 | Integrate package-level suites for runtime/orchestrator/memory/retrieval/CLI.                                                  |           |      |
| TASK-TESTING-008 | Add CI-focused deterministic pipelines and flake detection handling.                                                           |           |      |
| TASK-TESTING-009 | Validate multi-surface test parity outputs.                                                                                    |           |      |
| TASK-TESTING-015 | Migrate integration suites that currently use custom network stubs to MSW-backed handlers with deterministic fixture payloads. |           |      |

### Implementation Phase 4

- GOAL-TESTING-004: Hardening and release gates.

| Task             | Description                                                                                                                         | Completed | Date |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-TESTING-010 | Add performance/stress harness support for long-running scenarios.                                                                  |           |      |
| TASK-TESTING-011 | Update docs for contributors and test-author workflows.                                                                             |           |      |
| TASK-TESTING-012 | Pass package and monorepo release gates.                                                                                            |           |      |
| TASK-TESTING-016 | Add guardrails/lints/checklist rules ensuring new networked tests declare MSW handlers (or explicit rationale when not applicable). |           |      |

## 3. Acceptance Criteria

- **ACC-TESTING-001**: Shared harness behavior is stable and package-consumer validated.
- **ACC-TESTING-002**: CI reliability and deterministic-mode requirements are met.
- **ACC-TESTING-003**: Release gates pass.
- **ACC-TESTING-004**: Network mocking is standardized on MSW across package integration/e2e tests with reproducible handler-driven fixtures.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `https://mswjs.io/docs`
- `docs/packages/testing.md`
- `packages/testing/README.md`
- `packages/testing/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/testing — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/testing` is the **quality gatekeeper** of the framework. It provides the tooling necessary to test non-deterministic AI systems with confidence. It allows developers to write deterministic unit tests for parsing logic and probabilistic scenario tests for overall agent behavior.

It is used during the development and CI of nearly every other package, providing shared fixtures and mock providers.

### Ecosystem Sketch

```text
[ CI / CD Pipelines ] <--- Quality Gates
         |
         v
[ @agentsy/testing ] <--- Scenario Execution
         |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
 [ Mock Providers ]      [ Scenario Runner ]     [ Red Team Tooling ]
 (Deterministic LLM)     (LLM-Graded Tests)      (Adversarial Inputs)
         |                       |                       |
         +-----------+-----------+-----------+-----------+
                     |
                     v
            [ Vitest / Scenario ]
```

## Fulfillment of Role

The package fulfills its role by implementing a tiered testing strategy:

1. **Scenario Testing**: Integration with `@langwatch/scenario` for assessing model performance on specific tasks.
2. **Deterministic Mocks**: Providing `createMockLLM` to simulate byte-perfect streams and tool calls.
3. **Probabilistic Scoring**: Implementing "K-score" logic to handle LLM variance.
4. **Fault Injection**: Tools to simulate network failures, partial chunks, and malformed responses.

## Detailed Functionality

### 1. Scenario Tooling (`src/scenarios/`)

- **Mechanism**: `.scenario.ts` files containing task descriptions and success criteria.
- **Grading**: Uses a "Judge LLM" to evaluate the agent's output against the expected result.
- **Reporting**: Generates pass/fail rates and detailed failure analysis.

### 2. Mocking & Fixtures (`src/fixtures/`)

- **`createMockLLM`**: Allows developers to define a sequence of responses (text or tool calls) to be returned by a mock provider.
- **`FaultInjector`**: Randomly drops chunks, delays bytes, or injects garbage data into a stream to test framework resilience.

### 3. Red Teaming (`src/redteam/`)

- **Responsibility**: Security and safety verification.
- **Functionality**: A battery of prompts designed to trigger prompt injection, PII leakage, or unauthorized tool usage.

## Logic & Data Flow

### 1. The Scenario Flow

1. Developer defines a scenario in `__scenarios__/find-bug.scenario.ts`.
2. `runScenario()` initializes a `createTestAgent()`.
3. The scenario runner executes the agent turn-by-turn.
4. Output is sent to the Judge.
5. Result is aggregated into the project's overall K-score.

### 2. The Deterministic Test Flow

1. Developer uses `createMockLLM({ responses: [...] })`.
2. Test code calls `@agentsy/core` or `@agentsy/runtime` using the mock.
3. The framework processes the mock response as if it came from a real API.
4. Assertions verify that the internal state and events are correct.

## Key Interfaces

### ScenarioRunner

```typescript
export interface ScenarioRunner {
  run(file: string): Promise<EvaluationResult>;
  runBatch(pattern: string): Promise<BatchResult>;
}
```

### K-Score Logic

```typescript
export function passKScore(k: number, results: EvaluationResult[]): boolean {
  const successes = results.filter(r => r.score >= SUCCESS_THRESHOLD).length;
  return successes >= k;
}
```

## Implementation Details

### Source Aliasing

The package must be configured in `vitest.config.ts` to use workspace source aliases. This ensures that integration tests run against the latest TypeScript source rather than stale build artifacts.

### CI Integration

Every package must include at least one test that utilizes `@agentsy/testing` to ensure that the Turbo coverage pipeline is satisfied.

---

## Comprehensive Testing Strategy (migrated from `plan/agentsy-testing-plan.md`)

### Core requirements

- Provide test adapters: `createTestAgent`, `runScenario`, `runRedTeam`, `FaultInjector`, `passKScore`, `createMockLLM`.
- Enforce per-package coverage gates (line + branch) with CI reporting.
- Support both autopilot scenario mode and deterministic script mode.
- Support Crescendo red-team escalation with turn-level scoring.
- Add cache-key support for deterministic replay in CI.
- Report `pass^k` (k=3) and fail on consistency regressions.

### Five-layer test pyramid

1. Unit tests
2. Integration tests
3. Simulation scenario tests
4. Chaos/fault-injection tests
5. Red-team adversarial tests

### API surface to maintain

```ts
export function createTestAgent(factory, options?);
export function runScenario(config);
export function runRedTeam(config);
export function passKScore(results: boolean[], k?: number): number;
export class FaultInjector {
  delay;
  rateLimitOnCall;
  networkErrorOnCall;
  truncateResponse;
  wrap;
  reset;
}
export function createMockLLM(responses);
```

### Scenario metrics

- Task completion rate target: ≥ 85%
- `pass^k` (k=3) target: ≥ 70%
- Tool correctness target: ≥ 90%
- Policy violation rate target: 0%
- Mean turns to success target: ≤ 5

### CI expectations

- Set `SCENARIO_BATCH_RUN_ID=${GITHUB_RUN_ID}`
- Optional `LANGWATCH_API_KEY` for visualization
- Deterministic `SCENARIO_CACHE_KEY` for replay
- Include separate scenario/red-team configs and reporting

### Additional planned tasks

- Add per-package scenario files under `src/__scenarios__/`.
- Add red-team suites for prompt leakage, tool bypass, policy extraction, XML injection, and argument injection.
- Add chaos suites for timeout/429/network partition/partial result/DAG mid-failure recovery.
- Keep external API calls mocked in scenario tests (`FaultInjector`, `vi.fn()`).

## Sources Synthesized

`agentsy-testing-plan.md`, `owasp-security-testing-1.md`, `alignment-report-5-11-26.md`, `packages/testing/IMPLEMENTATION-PLAN.md`.
