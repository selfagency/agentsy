# @agentsy/testing — Implementation Plan

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
