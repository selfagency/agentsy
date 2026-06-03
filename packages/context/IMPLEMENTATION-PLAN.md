
## File Structure & Responsibilities

**New files:**

- `src/strategies/compression-strategy.ts` — Strategy pattern interface + registry
- `src/strategies/naive-dropping.ts` — Current naive FIFO drop (refactored)
- `src/strategies/anchored-iterative.ts` — ACON-inspired core compression
- `src/strategies/hierarchical-summarization.ts` — Layered compression stub
- `src/strategies/three-layer-offloading.ts` — Result/input/message offloading
- `src/drift/drift-scorer.ts` — Coherence + contradiction detection
- `src/drift/anchor-finder.ts` — Decision point identification
- `src/drift/drift-monitor.ts` — Session-level drift tracking
- `src/observability/compression-metrics.ts` — Efficacy measurement
- `src/providers/anthropic-provider.ts` — Prompt caching integration (Phase 4)
- `src/compression/output-compressor-v2.ts` — Enhanced output compression stub

**Modified files:**

- `src/index.ts` — Export new interfaces, maintain backward compat
- `src/compression/index.ts` — Export new types
- `package.json` — No new dependencies (keep minimal)
- `README.md` — Document strategies, drift, observability

**Test files (parallel to src/):**

- `src/strategies/*.test.ts`
- `src/drift/*.test.ts`
- `src/observability/*.test.ts`
- `src/providers/*.test.ts`

---

## Performance Baseline

| Strategy           | Memory Savings | Quality Loss | Computational Cost |
| ------------------ | -------------- | ------------ | ------------------ |
| Naive Dropping     | 40-60%         | HIGH         | VERY LOW           |
| Anchored Iterative | 30-40%         | LOW          | MEDIUM             |
| 3-Layer Offloading | 20-35%         | LOW          | LOW                |

## Roadmap

- [ ] Phase 4: Anthropic prompt caching integration
- [ ] Phase 5: Enhanced output compression with syntax awareness
- [ ] Phase 6: Automatic strategy selection via learned heuristics
- [ ] Hierarchical summarization strategy
      \`\`\`
- [ ] **Step 4: Run type check + test**

```bash
cd packages/context
pnpm check-types
pnpm test
```

````text

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts packages/context/README.md
git commit -m "docs: complete Phase 1-3, update exports & README with drift detection & strategies"
```

---


## Execution Path

**Recommended order for subagent-driven development:**

1. **Phase 1 (Tasks 1-4)**: Drift detection foundation — 45 min, 4 tasks
2. **Phase 2 (Tasks 5-8)**: Compression strategies — 60 min, 4 tasks
3. **Phase 3 (Tasks 9-10)**: Three-layer offloading — 45 min, 2 tasks
4. **Phase 4 (Task 11-12)**: Observability + exports — 30 min, 2 tasks

**Total**: ~3.5 hours, 12 tasks, zero external dependencies, full test coverage.

## Compression Strategies Comparison

| Strategy | Reduction | Quality Loss | Cost |
|----------|-----------|--------------|------|
| Naive Dropping | 40-60% | HIGH | VERY LOW |
| Anchored Iterative | 30-40% | LOW | MEDIUM |
| 3-Layer Offloading | 20-35% | LOW | LOW |


## Phase 3: Three-Layer Offloading (Efficiency) — Stub

### Task 9: Offloading Storage Adapter Interface (STUB)

- [ ] Create storage adapter interface
- [ ] Implement in-memory adapter for tests
- [ ] Add basic tests

**Deferred:** See IMPLEMENTATION-PLAN.md section "Phase 3: Three-Layer Offloading" for full implementation.

---


## Phase 4: Observability Loop (Continuous Improvement) — Stub

### Task 10: Compression Metrics Collector (STUB)

- [ ] Define metrics collection interface
- [ ] Implement basic collector
- [ ] Add strategy comparison

**Deferred:** See IMPLEMENTATION-PLAN.md section "Phase 4: Observability" for full implementation.

---
````
