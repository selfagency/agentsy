# Agentsy Default Agents — Planning Index

**Created:** 2026-06-03  
**Status:** Planning Phase Complete  
**Phase:** 31 (Default Agents Architecture)

---

## Document Structure

### [31-DEFAULT-AGENTS-EXECUTIVE-SUMMARY.md](31-DEFAULT-AGENTS-EXECUTIVE-SUMMARY.md)

## Stakeholder-facing overview of the complete default agents initiative

- Overview: Synthesis of 4 external frameworks (gpt-researcher, gpt-pilot, OpenAgentsControl, oh-my-openagent)
- Four agent specifications (Coder, Researcher, Planner, General)
- Architecture components (YAML specs, hooks, skills, budget)
- Implementation roadmap (7 phases, 38 hours total)
- Success criteria and deliverables checklist
- Integration points with existing Agentsy packages
- Risk mitigation strategies

**Use this for:** High-level planning, stakeholder communication, delivery tracking

---

### [32-DEFAULT-AGENTS-IMPLEMENTATION-PLAN.md](32-DEFAULT-AGENTS-IMPLEMENTATION-PLAN.md)

## Detailed, phase-by-phase implementation guide

- Phase 1: Research & Architecture (4h) ✅ COMPLETE
- Phase 2: YAML Agent Specifications (6h)
- Phase 3: Hook System Integration (8h)
- Phase 4: Skill Bindings (6h)
- Phase 5: Runtime Implementation (10h)
- Phase 6: CLI & Demo (8h)
- Phase 7: Testing & Validation (6h)
- Key design decisions for each phase
- Agent specifications with roles, skills, hooks
- Implementation checklist
- Timeline estimates

**Use this for:** Day-to-day development tracking, phase execution, task breakdowns

---

### [33-DEFAULT-AGENTS-ARCHITECTURE.md](33-DEFAULT-AGENTS-ARCHITECTURE.md)

## Deep-dive technical reference for architecture patterns

- Pattern Mapping (gpt-researcher → Planner-Executor, gpt-pilot → Role Hierarchy, etc.)
- Hook System Architecture (core events, per-agent implementations, registration patterns)
- Agent Composition Patterns (sequential, parallel, Sisyphus tree-based)
- Skill Activation & Composition (minimal disclosure, pattern learning, cost-aware routing)
- Token Budget Architecture (hierarchical allocation, enforcement hooks)
- Implementation summary table

**Use this for:** Architecture reviews, hook system design, pattern reference

---

## Agent Definitions at a Glance

### 1. Coder Agent (45K tokens/session)

## Sequential role hierarchy for code generation

```text
Spec Writer → Architect → Test Engineer → Implementer → Code Reviewer
```

Pattern source: **gpt-pilot**

### 2. Researcher Agent (30K tokens/session)

## Planner-Executor for deep research

```text
Query Planner → Executor (parallel searches) → Synthesizer
```

Pattern source: **gpt-researcher**

### 3. Planner Agent (20K tokens/session)

## Sisyphus-style task decomposition

```text
Goal Analyzer → Task Decomposer → Milestone Tracker (with dependency DAG)
```

Pattern source: **oh-my-openagent**

### 4. General Agent (5K tokens/session)

## Adaptive routing and pattern learning

```text
Task Router → Reasoning Engine + Pattern Learner + Cost Optimizer
```

Pattern source: **OpenAgentsControl**

---

## Implementation Status

| Phase | Status | Effort | Deliverables |
|-------|--------|--------|---|
| Phase 1: Research & Architecture | ✅ COMPLETE | 4h | Architecture docs + pattern analysis |
| Phase 2: YAML Specifications | ⏳ READY | 6h | Agent specs, loader, parser, validator |
| Phase 3: Hook Integration | ⏳ READY | 8h | Agent hooks, budget enforcement, memory |
| Phase 4: Skill Bindings | ⏳ READY | 6h | Registry, activation, composition logic |
| Phase 5: Runtime Implementation | ⏳ READY | 10h | Executors (seq/par/sisyphus) |
| Phase 6: CLI & Demo | ⏳ READY | 8h | CLI commands, REPL, dogfood scenarios |
| Phase 7: Testing & Validation | ⏳ READY | 6h | Unit/integration/E2E tests |
| Buffer | ⏳ READY | 4h | Documentation, fixes |

**Total Effort:** 38 hours over 2-3 weeks at 8-10h/week

---

## Key Design Decisions

1. **YAML-First**: Introspectable agent definitions, version-controllable
2. **Hook-Based Composition**: Leverage Agentsy's existing hook system
3. **Budget-Driven Skills**: Cost-aware selection + pattern learning
4. **Per-Agent Hooks**: Global hooks + agent-specific customizations
5. **Sequential vs Parallel vs Sisyphus**: Execution patterns match agent needs

---

## Integration Points

Integrates with all core Agentsy packages:

- `@agentsy/orchestrator` - Hook registry
- `@agentsy/runtime` - Hook dispatch
- `@agentsy/context` - Budget enforcement
- `@agentsy/memory` - Observations capture
- `@agentsy/tokenomics` - Cost tracking
- `@agentsy/cli` - New commands

---

## Next Steps

1. **Review & Approve** → Get stakeholder sign-off on plan
2. **Phase 2 Start** → Begin YAML spec design and loader implementation
3. **Phase 3 Integration** → Wire hooks into runtime
4. **Phase 5 Runtime** → Build executors
5. **Phase 6 Dogfood** → Test agents on real scenarios
6. **Phase 7 Release** → Full validation + handoff

---

## References

**External Frameworks Analyzed:**

- [gpt-researcher](https://github.com/assafelovic/gpt-researcher) - Planner-executor research pattern
- [gpt-pilot](https://github.com/Pythagora-io/gpt-pilot) - Sequential role hierarchy for coding
- [OpenAgentsControl](https://github.com/darrenhinde/OpenAgentsControl) - YAML specs + pattern learning
- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) - Sisyphus task orchestration

**Agentsy Foundation:**

- Hook System: `packages/runtime/src/hooks/`
- Orchestrator: `packages/orchestrator/src/core/`
- Context Management: `packages/context/`
- Memory Integration: `packages/memory/`
- Tokenomics: `packages/tokenomics/`

---

## Document History

| Date | Change |
|------|--------|
| 2026-06-03 | Phase 1 complete, documentation created |

---

**Last Updated:** 2026-06-03  
**Authority:** Planning Phase Complete, Ready for Phase 2 kickoff
