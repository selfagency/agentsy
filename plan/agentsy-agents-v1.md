---
goal: "@agentsy/agents — one package: caveman mode, superpowers mode, garry's mode + custom agent docs"
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['feature', 'agents', 'caveman', 'superpowers', 'garrys-mode', 'custom-agents', 'docs', 'agentsy']
---

# @agentsy Platform — Custom Agents Package v1

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Introduces `@agentsy/agents` — a single self-contained package bundling three agent modes directly (no peer packages, no composition layer):

1. **Caveman mode** — token-compression SKILL.md set (JuliusBrussee/caveman v1.7.0) + `caveman-shrink` MCP proxy
2. **Superpowers mode** — context-activated methodology skills (obra/superpowers v5.0.7)
3. **Garry's mode** — sprint-workflow orchestration adapted from garrytan/gstack: office hours → plan → build → review → test → ship → reflect

All three modes live directly in `packages/agents/`. There are no separate `@agentsy/caveman` or `@agentsy/superpowers` packages — those planned in `agentsy-features-v1.md` Phase 6 are superseded by this plan. All modes are documented as worked examples in `docs/developers/custom-agents.md`.

Existing REQ/SEC/CON/ADR identifiers are preserved.

---

## 1. Requirements & Constraints

- **REQ-071**: `@agentsy/agents` MUST export three agent mode factories: `createCavemanManager`, `createSuperpowersActivator`, `createGarrysAgent`. Each MUST implement the `AgentModeFactory<TOptions, TActivator>` interface defined in `packages/agents/src/types.ts`.
- **REQ-072**: All SKILL.md files for all three modes MUST be bundled directly inside `packages/agents/src/skills/`. No external `@agentsy/caveman` or `@agentsy/superpowers` packages.
- **REQ-073**: Garry's mode MUST bundle nine sprint SKILL.md files: `office-hours`, `plan-ceo-review`, `plan-eng-review`, `review`, `ship`, `qa`, `cso`, `investigate`, `autoplan`. Each file MUST include `source_url`, `version`, `license: "MIT"` frontmatter (GUD-008).
- **REQ-074**: `GarrysActivator.detectPhase(context)` MUST infer the current sprint phase (`think | plan | build | review | test | ship | reflect`) from context signals: PR diff present → `review`, test failures → `test`, open-ended product question → `think`.
- **REQ-075**: `GarrysActivator.selectSkills(phase)` MUST return the relevant `GarrysSkillManifest[]` subset for the given phase with no more than three active skills at once.
- **REQ-076**: Garry's mode checkpoint MUST integrate with `@agentsy/agent` session to emit a `WIP:` prefixed commit message after every tool-call turn when `checkpointMode: true`. Commit body MUST include a `[gstack-context]` block: decisions, remaining work, failed approaches.
- **REQ-077**: Garry's mode safety guardrails MUST register a pre-execution hook with `@agentsy/runtime` approval engine that fires a `SafetyGuardrailTriggered` event before any tool call matching the destructive pattern list: `rm -rf`, `DROP TABLE`, `force-push`, `git reset --hard`, `git push --force`.
- **REQ-078**: Garry's mode design taste memory MUST persist per-project decisions to `~/.agentsy/taste/<projectId>.json` via `@agentsy/memory` with `retentionTag: 'design-preference'`. Taste scores MUST decay 5% per week.
- **REQ-079**: `docs/developers/custom-agents.md` MUST document the custom agent pattern with three worked examples (caveman, superpowers, garry's mode), each showing: (a) SKILL.md bundling, (b) context-signal activation, (c) factory pattern, (d) agent loop integration.
- **REQ-080**: `@agentsy/agents` MUST have zero runtime dependencies beyond `@agentsy/core`. `@agentsy/memory` is a peer dependency used only when garry's mode `tasteMemory` option is enabled.
- **REQ-103**: Garry's `investigate` sprint phase MUST implement a LATS-style multi-path exploration: the agent proposes up to 3 alternative investigation strategies, evaluates each via a lightweight scoring prompt, then commits to the highest-scoring path. Max tree depth: 2.
- **REQ-104**: Garry's `review` sprint phase MUST implement an Evaluator-Optimizer loop: a generator sub-turn produces the review, an evaluator sub-turn critiques it against the rubric (correctness, security, style), and up to 2 refinement passes are made before the final review is emitted.
- **REQ-109**: Garry's mode sprint phases MUST implement the Gate-Driven pattern (ADR-056): each phase defines explicit success gates (verification criteria) before executing tool calls. Gates are declared in the SKILL.md frontmatter as `success_gates: [...]` and verified by deterministic checks (tests, lints, compilation) — not agent self-assessment.
- **SEC-017**: Garry's mode safety guardrails MUST NOT be bypassable at runtime. The `safetyGuardrails: false` option MUST emit a `SafetyDisabledWarning` event and require `{ override: 'I understand the risks' }` confirmation string.
- **SEC-018**: Garry's mode design taste memory MUST NOT store LLM outputs verbatim — only structured `{ approved: boolean, dimensionKey: string, score: number, timestamp: number }` entries.
- **CON-013**: `@agentsy/agents` MUST NOT vendor any gstack source code. SKILL.md files are adapted content under MIT license with attribution; the gstack binary/runtime is NOT imported or bundled.
- **CON-014**: Garry's mode MUST NOT depend on a running gstack installation. All sprint skills are self-contained SKILL.md prompts adapted from gstack's methodology.
- **CON-015**: There are no separate `@agentsy/caveman` or `@agentsy/superpowers` packages. `agentsy-features-v1.md` Phase 6 is superseded by this plan.
- **GUD-011**: All `AgentModeFactory` implementations MUST include a `README.md` showing a minimal usage example.
- **GUD-012**: `docs/developers/custom-agents.md` MUST link to the upstream source of each bundled skill for attribution.
- **GUD-016**: Garry's mode `autoplan` SKILL.md MUST enforce Discrete Phase Separation: no tool writes are permitted during the plan phase; writes are only permitted after the plan is confirmed. Plan artifacts are immutable until the phase gate is passed.
- **GUD-018**: Garry's mode SKILL.md files MUST include an `Implementation Notes` section template. When Garry completes a sprint phase, it MUST emit a structured discovery record: which files were inspected, which patterns were found, which assumptions were invalidated. These notes persist to `.agents/tasks/<issue>/` for cross-session continuity (SRC-32).

---

## 2. Implementation Steps

### Phase AG1 — `@agentsy/agents` Package Scaffolding

- **GOAL-AG1**: Create `packages/agents/` as a single self-contained package with `AgentModeFactory` interface and skill directory layout.

| Task         | Description                                                                                                                                                                                                                                                                  | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG1-001 | Create `packages/agents/`. Add `package.json` (`@agentsy/agents`, peerDeps: `@agentsy/core@workspace:*`, `@agentsy/memory@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`. No `@agentsy/caveman` or `@agentsy/superpowers` dependencies.                |           |      |
| TASK-AG1-002 | Define `AgentModeFactory<TOptions, TActivator>` interface in `packages/agents/src/types.ts`: `{ create(options?: TOptions): TActivator; name: string; description: string; skillCount(): number }`. Export `AgentMode` type union: `'caveman' \| 'superpowers' \| 'garrys'`. |           |      |
| TASK-AG1-003 | Create skill directory tree: `packages/agents/src/skills/caveman/`, `packages/agents/src/skills/superpowers/`, `packages/agents/src/skills/garrys/`. Each directory will hold bundled SKILL.md files (populated in AG2).                                                     |           |      |
| TASK-AG1-004 | Export stub barrel from `packages/agents/src/index.ts`: `createCavemanManager`, `createSuperpowersActivator`, `createGarrysAgent`, `AgentMode`, `AgentModeFactory`. Stubs filled in AG2/AG3.                                                                                 |           |      |
| TASK-AG1-005 | Add `@agentsy/agents -> @agentsy/core` to turbo dependency graph in `turbo.json` and `pnpm-workspace.yaml`.                                                                                                                                                                  |           |      |

### Phase AG2 — SKILL.md Files: All Three Modes

- **GOAL-AG2**: Bundle all SKILL.md files for caveman, superpowers, and garry's mode directly in `packages/agents/src/skills/`. MIT-attributed, self-contained.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                                         | Completed | Date |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG2-001 | Bundle JuliusBrussee/caveman v1.7.0 SKILL.md files into `packages/agents/src/skills/caveman/`: `caveman.md`, `caveman-lite.md`, `caveman-ultra.md`, `wenyan.md`. Add `cavecrew/investigator.md`, `cavecrew/builder.md`, `cavecrew/reviewer.md`. All include `source_url`, `version: "1.7.0"`, `license: "MIT"` frontmatter. Add `_manifest.ts`: `CAVEMAN_SKILLS_VERSION`, `CAVEMAN_SOURCE_URL`.     |           |      |
| TASK-AG2-002 | Bundle obra/superpowers v5.0.7 SKILL.md files into `packages/agents/src/skills/superpowers/`: `brainstorming.md`, `git-worktrees.md`, `writing-plans.md`, `subagent-driven-development.md`, `tdd.md`, `code-review.md`, `finish-branch.md`. All include `source_url`, `version: "5.0.7"`, `license: "MIT"` frontmatter. Add `_manifest.ts`: `SUPERPOWERS_SKILLS_VERSION`, `SUPERPOWERS_SOURCE_URL`. |           |      |
| TASK-AG2-003 | Add `_manifest.ts` to `packages/agents/src/skills/garrys/` exporting `GARRYS_SKILLS_VERSION = '1.26.0'` and `GARRYS_SOURCE_URL = 'https://github.com/garrytan/gstack'`.                                                                                                                                                                                                                             |           |      |
| TASK-AG2-004 | Write `packages/agents/src/skills/garrys/office-hours.md` — YC Office Hours: six forcing questions that reframe the product before coding. Pushes back on framing, challenges premises, generates three implementation alternatives with effort estimates. Frontmatter: `phase: "think"`.                                                                                                           |           |      |
| TASK-AG2-005 | Write `packages/agents/src/skills/garrys/plan-ceo-review.md` — CEO scope review: four modes (Expansion, Selective Expansion, Hold Scope, Reduction). Challenges scope, 10-section review. Frontmatter: `phase: "think"`.                                                                                                                                                                            |           |      |
| TASK-AG2-006 | Write `packages/agents/src/skills/garrys/plan-eng-review.md` — Engineering review: ASCII data flow + state machine diagrams, test matrix, edge cases, failure modes, security concerns. Locks architecture before build. Frontmatter: `phase: "plan"`.                                                                                                                                              |           |      |
| TASK-AG2-007 | Write `packages/agents/src/skills/garrys/review.md` — Staff engineer code review: finds bugs that pass CI but blow up in production. Auto-fixes obvious issues. Frontmatter: `phase: "review"`.                                                                                                                                                                                                     |           |      |
| TASK-AG2-008 | Write `packages/agents/src/skills/garrys/ship.md` — Release engineering: sync main, run tests, audit coverage, push, open PR. Bootstraps test frameworks if absent. Frontmatter: `phase: "ship"`.                                                                                                                                                                                                   |           |      |
| TASK-AG2-009 | Write `packages/agents/src/skills/garrys/qa.md` — QA: systematic test-and-fix loop, auto-generates regression test for every bug fixed. Adapts to available tool set (no browser assumed). Frontmatter: `phase: "test"`.                                                                                                                                                                            |           |      |
| TASK-AG2-010 | Write `packages/agents/src/skills/garrys/cso.md` — OWASP Top 10 + STRIDE threat model. 8/10+ confidence gate, independent verification. Each finding includes a concrete exploit scenario. Frontmatter: `phase: "review"`.                                                                                                                                                                          |           |      |
| TASK-AG2-011 | Write `packages/agents/src/skills/garrys/investigate.md` — Root-cause debugging: Iron Law — no fixes without investigation. Stops after three failed fix attempts. Frontmatter: `phase: "build"`.                                                                                                                                                                                                   |           |      |
| TASK-AG2-012 | Write `packages/agents/src/skills/garrys/autoplan.md` — Pipeline orchestrator: runs office-hours → plan-ceo-review → plan-eng-review in sequence, passing design doc output as context. Frontmatter: `phase: "think"`.                                                                                                                                                                              |           |      |

### Phase AG3 — Manager + Activator Implementations

- **GOAL-AG3**: Implement `CavemanManager`, `SuperpowersActivator`, and `GarrysActivator` directly in `packages/agents/src/`, reading from their bundled `src/skills/` directories.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG3-001 | Define caveman types in `packages/agents/src/caveman/types.ts`: `CavemanMode` (`'lite' \| 'full' \| 'ultra' \| 'wenyan-lite' \| 'wenyan-full' \| 'wenyan-ultra'`), `DEFAULT_CAVEMAN_MODE: CavemanMode = 'full'`, `CavemanSkillManifest { name, mode, skillPath }`.                                                                                                                                                                                            |           |      |
| TASK-AG3-002 | Implement `CavemanManager` in `packages/agents/src/caveman/manager.ts`. Methods: `activate(mode: CavemanMode): string` (returns SKILL.md content), `deactivate(): void`, `getActiveMode(): CavemanMode \| null`, `listSkills(): CavemanSkillManifest[]`. Reads from `src/skills/caveman/`. Export `createCavemanManager()` factory.                                                                                                                           |           |      |
| TASK-AG3-003 | Implement `caveman-shrink` MCP proxy as standalone stdio script `packages/agents/bin/caveman-shrink.js`. Spawns downstream MCP server, intercepts `tools/list` responses, compresses `description` fields only — never alters `inputSchema` (SEC-010 equivalent). Add `"bin": { "caveman-shrink": "./bin/caveman-shrink.js" }` to `package.json`.                                                                                                             |           |      |
| TASK-AG3-004 | Define superpowers types in `packages/agents/src/superpowers/types.ts`: `SuperpowersContext { hasTestFiles?, hasDiff?, isOpenEndedPlan?, requestedSkills?, projectRoot? }`, `SuperpowersSkillName` union of 7 skill names, `DEFAULT_SUPERPOWERS_CONTEXT`.                                                                                                                                                                                                     |           |      |
| TASK-AG3-005 | Implement `SuperpowersActivator` in `packages/agents/src/superpowers/activator.ts`. Method `selectSkills(context: SuperpowersContext): string[]` maps context signals to skill SKILL.md contents: `hasTestFiles → tdd`, `hasDiff → code-review`, `isOpenEndedPlan → brainstorming`, `requestedSkills` overrides signals. Export `createSuperpowersActivator()` factory.                                                                                       |           |      |
| TASK-AG3-006 | Define garry's mode types in `packages/agents/src/garrys/types.ts`: `GarrysSprintPhase` (`think \| plan \| build \| review \| test \| ship \| reflect`), `GarrysSkillName` (union of 9 skill names), `GarrysSkillManifest { name, phase, skillPath, description }`, `GarrysContext { hasDiff?, hasTestFailures?, isProductQuestion?, hasSecurityConcern?, sprintPhase? }`, `GarrysOptions { phase?, checkpointMode?, safetyGuardrails?, tasteProfilePath? }`. |           |      |
| TASK-AG3-007 | Implement `detectPhase(context: GarrysContext): GarrysSprintPhase` in `packages/agents/src/garrys/activator.ts`. Rules: `hasDiff && !hasTestFailures` → `review`; `hasTestFailures` → `test`; `isProductQuestion` → `think`; `hasSecurityConcern` → `review`; explicit `sprintPhase` overrides all.                                                                                                                                                           |           |      |
| TASK-AG3-008 | Implement `selectSkills(phase: GarrysSprintPhase): GarrysSkillManifest[]` returning at most 3 skills. Phase→skill map: `think` → [office-hours, plan-ceo-review, autoplan]; `plan` → [plan-eng-review]; `build` → [investigate]; `review` → [review, cso]; `test` → [qa]; `ship` → [ship]; `reflect` → [].                                                                                                                                                    |           |      |
| TASK-AG3-009 | Implement checkpoint in `packages/agents/src/garrys/checkpoint.ts`. `createCheckpointHook({ projectRoot })` returns a `postTurnHook` for `AgentLoopOptions.onStep`: after each tool-call turn runs `git add -A && git commit -m "WIP: <summary>" -m "[gstack-context]\ndecisions:\nremaining:\nfailed:"`. Skips if working tree clean; silently emits `CheckpointUnavailable` if git not found.                                                               |           |      |
| TASK-AG3-010 | Implement safety guardrails in `packages/agents/src/garrys/guardrails.ts`. `createSafetyGuardrailHook()` returns a pre-execution hook that matches tool calls against `DESTRUCTIVE_PATTERNS` (`rm -rf`, `DROP TABLE`, `force-push`, `git reset --hard`, `git push --force`). Match → emit `SafetyGuardrailTriggered`, return `'ask'`. `safetyGuardrails: false` requires `{ override: 'I understand the risks' }` else throws (SEC-017).                      |           |      |
| TASK-AG3-011 | Implement taste memory in `packages/agents/src/garrys/taste.ts`. `createTasteMemory({ projectId, tasteProfilePath? })`. Methods: `record(entry: TasteEntry): void`, `getProfile(): TasteProfile`, `decay(): void`. Writes via `@agentsy/memory` with `retentionTag: 'design-preference'`. `decay()` multiplies all scores by 0.95 (SEC-018 — no free-text stored).                                                                                            |           |      |
| TASK-AG3-012 | Implement `GarrysActivator` in `packages/agents/src/garrys/activator.ts`. Methods: `detectPhase`, `selectSkills`, `getSkillContent(name: GarrysSkillName): string`, `listSkills(): GarrysSkillManifest[]`. Reads SKILL.md files from `src/skills/garrys/` at module init.                                                                                                                                                                                     |           |      |
| TASK-AG3-013 | Implement `createGarrysAgent(options?: GarrysOptions)` factory in `packages/agents/src/garrys/index.ts`. Returns `{ activator: GarrysActivator, checkpointHook?, safetyHook?, tasteMemory? }` — each component enabled by its option flag.                                                                                                                                                                                                                    |           |      |
| TASK-AG3-014 | Export from `packages/agents/src/index.ts`: `createCavemanManager`, `CavemanMode`, `createSuperpowersActivator`, `SuperpowersContext`, `createGarrysAgent`, `GarrysActivator`, `GarrysSprintPhase`, `GarrysSkillName`, `GarrysOptions`, `GarrysContext`, `AgentMode`, `AgentModeFactory`.                                                                                                                                                                     |           |      |

### Phase AG4 — Tests

- **GOAL-AG4**: Full unit test coverage for all three mode managers/activators, guardrails, checkpoint, taste memory, and bundled SKILL.md integrity.

| Task         | Description                                                                                                                                                                                                                                                                                                       | Completed | Date |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG4-001 | Write `packages/agents/src/caveman/manager.test.ts`. Cases: `activate('full')` returns non-empty string; `activate('ultra')` shorter than `activate('lite')`; `listSkills()` returns all 3 cavecrew variants; SKILL.md files exist with required frontmatter.                                                     |           |      |
| TASK-AG4-002 | Write `packages/agents/src/superpowers/activator.test.ts`. Cases: `hasTestFiles: true` → `tdd`; `hasDiff: true` → `code-review`; `isOpenEndedPlan: true` → `brainstorming`; `requestedSkills: ['writing-plans']` → `writing-plans` regardless of signals; SKILL.md files have required frontmatter.               |           |      |
| TASK-AG4-003 | Write `packages/agents/src/garrys/activator.test.ts`. Cases: `hasDiff: true` → `review` → [review, cso]; `hasTestFailures: true` → `test` → [qa]; `isProductQuestion: true` → `think` → [office-hours, plan-ceo-review, autoplan]; explicit `sprintPhase: 'ship'` overrides; `selectSkills` returns ≤3 per phase. |           |      |
| TASK-AG4-004 | Write `packages/agents/src/garrys/guardrails.test.ts`. Cases: `rm -rf /tmp/x` → `SafetyGuardrailTriggered` + `'ask'`; `git push origin main` (non-force) does NOT trigger; `safetyGuardrails: false` with wrong override string throws; `DESTRUCTIVE_PATTERNS` list has ≥5 entries.                               |           |      |
| TASK-AG4-005 | Write `packages/agents/src/garrys/taste.test.ts`. Cases: `record()` writes entry; `getProfile()` returns sorted entries; `decay()` multiplies scores by 0.95; score never below 0; entry shape is exactly `{ approved, dimensionKey, score, timestamp }` (SEC-018).                                               |           |      |
| TASK-AG4-006 | Write `packages/agents/src/agents.test.ts`. Cases: all three factories satisfy `AgentModeFactory` interface shape; `createCavemanManager()` has `activate` method; `createSuperpowersActivator()` has `selectSkills`; `createGarrysAgent()` has activator with all 9 skills listable.                             |           |      |
| TASK-AG4-007 | Write `packages/agents/src/skills.test.ts`. For each SKILL.md in all three `src/skills/*/` directories: file exists, frontmatter contains `source_url`, `version`, `license`, content is non-empty, garry's mode files do not reference gstack CLI binaries or `~/.claude/skills/gstack`.                         |           |      |

### Phase AG5 — Documentation

- **GOAL-AG5**: Write `docs/developers/custom-agents.md` showing the full custom agent pattern with all three modes as worked examples.

| Task         | Description                                                                                                                                                                                                                          | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-AG5-001 | Create `docs/developers/custom-agents.md`. Section 1: What is a custom agent mode? — `AgentModeFactory` pattern, SKILL.md bundling, context-signal activation, integration with `AgentLoopOptions`.                                  |           |      |
| TASK-AG5-002 | Section 2: Caveman mode example — mode switching (`lite \| full \| ultra`), SKILL.md injection into system prompt, `caveman-shrink` MCP proxy config. Attribution: JuliusBrussee/caveman.                                            |           |      |
| TASK-AG5-003 | Section 3: Superpowers mode example — context signal detection (`hasTestFiles → tdd`, `hasDiff → code-review`), `selectSkills(context)` return, wiring into `AgentLoopOptions.systemPrompt`. Attribution: obra/superpowers.          |           |      |
| TASK-AG5-004 | Section 4: Garry's mode example — sprint phase detection, `selectSkills(phase)` return, enabling checkpoint mode + safety guardrails + taste memory, full `createAgentLoop` integration. Attribution: garrytan/gstack.               |           |      |
| TASK-AG5-005 | Section 5: Build your own — minimal template: (a) create SKILL.md with frontmatter, (b) implement `AgentModeFactory`, (c) `getSkillContent()` reads bundled SKILL.md, (d) inject into `AgentLoopOptions.systemPrompt`. Max 30 lines. |           |      |
| TASK-AG5-006 | Add `custom-agents` entry to `docs/developers/index.md` nav. Verify links from `docs/index.md` and `README.md` resolve correctly.                                                                                                    |           |      |

---

## 3. Alternatives

- **ALT-012**: Keep `@agentsy/caveman` and `@agentsy/superpowers` as separate packages that `@agentsy/agents` composes. Rejected — one package is simpler, avoids version drift between the packages, and consumers shouldn't need to install three packages to get the pre-built modes.
- **ALT-013**: Wrap the actual gstack CLI as a child process rather than adapting SKILL.md files. Rejected: violates CON-014 (no gstack binary dependency); requires gstack to be installed; couples version to external release cadence.
- **ALT-014**: Skip garry's mode; ship only caveman and superpowers. Rejected — garry's mode is the most sophisticated example and the docs benefit from showing increasing complexity across the three modes.
- **ALT-015**: Put garry's mode in a separate `@agentsy/garrys` package. Rejected — same reasoning as ALT-012; one package.

---

## 4. Dependencies

- **DEP-012**: `@agentsy/core@workspace:*` — only required runtime package dependency.
- **DEP-013**: `@agentsy/memory@workspace:*` — peer dependency; required only when garry's mode `tasteMemory` option is enabled.
- **DEP-014**: JuliusBrussee/caveman v1.7.0 — SKILL.md files adapted as static assets. MIT license. No runtime import.
- **DEP-015**: obra/superpowers v5.0.7 — SKILL.md files adapted as static assets. MIT license. No runtime import.
- **DEP-016**: garrytan/gstack v1.26.0 — SKILL.md methodology adapted as static content. MIT license. No runtime import; no binary dependency.

---

## 5. Files

- **FILE-015**: `packages/agents/` — new package (`@agentsy/agents`)
- **FILE-016**: `packages/agents/src/types.ts` — `AgentModeFactory`, `AgentMode`
- **FILE-017**: `packages/agents/src/caveman/types.ts` — `CavemanMode`, `CavemanSkillManifest`
- **FILE-018**: `packages/agents/src/caveman/manager.ts` — `CavemanManager`, `createCavemanManager`
- **FILE-019**: `packages/agents/src/superpowers/types.ts` — `SuperpowersContext`, `SuperpowersSkillName`
- **FILE-020**: `packages/agents/src/superpowers/activator.ts` — `SuperpowersActivator`, `createSuperpowersActivator`
- **FILE-021**: `packages/agents/src/garrys/types.ts` — `GarrysSprintPhase`, `GarrysSkillName`, `GarrysContext`, `GarrysOptions`
- **FILE-022**: `packages/agents/src/garrys/activator.ts` — `GarrysActivator`, `detectPhase`, `selectSkills`
- **FILE-023**: `packages/agents/src/garrys/checkpoint.ts` — `createCheckpointHook`
- **FILE-024**: `packages/agents/src/garrys/guardrails.ts` — `createSafetyGuardrailHook`
- **FILE-025**: `packages/agents/src/garrys/taste.ts` — `createTasteMemory`
- **FILE-026**: `packages/agents/src/garrys/index.ts` — `createGarrysAgent` factory
- **FILE-027**: `packages/agents/src/skills/caveman/*.md` — caveman SKILL.md files (7 files)
- **FILE-028**: `packages/agents/src/skills/superpowers/*.md` — superpowers SKILL.md files (7 files)
- **FILE-029**: `packages/agents/src/skills/garrys/*.md` — garry's mode SKILL.md files (9 files)
- **FILE-030**: `packages/agents/bin/caveman-shrink.js` — standalone MCP proxy binary
- **FILE-031**: `packages/agents/src/index.ts` — package barrel
- **FILE-032**: `docs/developers/custom-agents.md` — new documentation page

---

## 6. Testing

- **TEST-AG-001**: `caveman/manager.test.ts` — `activate` returns content, `ultra` shorter than `lite`, cavecrew variants listed
- **TEST-AG-002**: `superpowers/activator.test.ts` — context signal → skill mapping (4 cases), `requestedSkills` override
- **TEST-AG-003**: `garrys/activator.test.ts` — phase detection (5 cases), `selectSkills` ≤3 per phase
- **TEST-AG-004**: `garrys/guardrails.test.ts` — destructive pattern matching (≥5 patterns), SEC-017 override enforcement
- **TEST-AG-005**: `garrys/taste.test.ts` — `record`, `getProfile`, `decay`, SEC-018 shape constraint
- **TEST-AG-006**: `agents.test.ts` — all three factories satisfy `AgentModeFactory` interface
- **TEST-AG-007**: `skills.test.ts` — all 23 bundled SKILL.md files have required frontmatter, garry's files contain no gstack CLI refs

---

## 7. Risks & Assumptions

- **RISK-AG-001**: gstack skill files are described in MIT-licensed README/docs but may need wording adaptation to avoid verbatim reproduction. Mitigation: adapt prompt language; preserve attribution frontmatter.
- **RISK-AG-002**: Checkpoint mode requires `git` in PATH. Mitigation: `createCheckpointHook` detects missing git silently, emits `CheckpointUnavailable` event rather than throwing.
- **ASSUMPTION-AG-001**: `@agentsy/memory` write API is available (depends on Platform Phase X9 from agentsy-platform-v2.md).
- **ASSUMPTION-AG-002**: `agentsy-features-v1.md` Phase 6 (`@agentsy/caveman`, `@agentsy/superpowers`) is NOT implemented — this plan supersedes it.

---

## 8. Related Specifications / Further Reading

- [agentsy-features-v1.md](agentsy-features-v1.md) — Phase 6 superseded by this plan; Phase 8 (ConnectorGateway core)
- [agentsy-platform-v2.md](agentsy-platform-v2.md) — Phase X9 (team-scoped memory bank, required for taste memory)
- [agentsy-connectors-v1.md](agentsy-connectors-v1.md) — extended channel adapter plan
- [garrytan/gstack](https://github.com/garrytan/gstack) — MIT-licensed sprint workflow skills (SRC-30)
- [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) — token compression SKILL.md (DEP-014)
- [obra/superpowers](https://github.com/obra/superpowers) — methodology skills (DEP-015)
- [agentsy-deep-dive-v2.md](agentsy-deep-dive-v2.md) — ADR-037 (skill files as sprint lifecycle), ADR-044 (shared memory), ADR-048 (12-factor agent)
