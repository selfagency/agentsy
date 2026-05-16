# Cache-Aware Context Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cache-aware reusable context fingerprints across memory, core context assembly, and session resume so Agentsy can reuse stable prompt segments safely and deterministically.

**Architecture:** The cache boundary lives at the context-assembly layer, not the model backend. `@agentsy/memory` owns reusable content fingerprints and eligibility metadata, `@agentsy/core` assembles and validates cacheable context segments, and `@agentsy/session` persists reuse metadata across snapshots so resumed sessions can rebuild only what changed.

**Tech Stack:** TypeScript, Vitest, existing `@agentsy/types`, existing core structured-output/context utilities, session snapshot store implementations

---

## Task 1: Define cacheable context metadata

**Files:**

- Modify: `packages/memory/src/types.ts`
- Modify: `packages/memory/src/index.ts`
- Test: `packages/memory/src/cache-metadata.test.ts`
- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { ContextFingerprint, MemoryReuseHint } from "./types.js";

describe("cache-aware memory metadata", () => {
  it("represents a stable fingerprint and reuse hints", () => {
    const fingerprint: ContextFingerprint = {
      value: "sha256:abc123",
      modelFamily: "qwen",
      templateVersion: "v3",
      schemaVersion: 1,
    };

    const hint: MemoryReuseHint = {
      reuseClass: "hot",
      stablePrefix: true,
      toolSchema: true,
      invalidationKeys: ["model-family:qwen", "template:v3"],
    };

    expect(fingerprint.value).toBe("sha256:abc123");
    expect(hint.reuseClass).toBe("hot");
    expect(hint.invalidationKeys).toContain("template:v3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agentsy/memory test packages/memory/src/cache-metadata.test.ts -v`
Expected: FAIL because `ContextFingerprint` and `MemoryReuseHint` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ContextFingerprint {
  value: string;
  modelFamily: string;
  templateVersion: string;
  schemaVersion: number;
}

export interface MemoryReuseHint {
  reuseClass: "hot" | "warm" | "cold";
  stablePrefix: boolean;
  toolSchema: boolean;
  invalidationKeys: string[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agentsy/memory test packages/memory/src/cache-metadata.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/memory/src/types.ts packages/memory/src/index.ts packages/memory/src/cache-metadata.test.ts
git commit -m "feat(memory): add cache-aware context metadata"
```

## Task 2: Add reusable context-segment assembly

**Files:**

- Modify: `packages/core/src/structured/providerFormats.ts`
- Create: `packages/core/src/context/contextSegments.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/context/contextSegments.test.ts`
- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildContextSegments } from "./contextSegments.js";

describe("buildContextSegments", () => {
  it("preserves stable segments and marks invalidations", () => {
    const segments = buildContextSegments({
      systemPrompt: "You are helpful",
      toolSchema: { type: "object", properties: { name: { type: "string" } } },
      memorySummary: "cached summary",
      modelFamily: "qwen",
      templateVersion: "v3",
    });

    expect(segments[0]?.fingerprint.value).toContain("systemPrompt");
    expect(segments.some((segment) => segment.reuseClass === "hot")).toBe(true);
    expect(
      segments.some((segment) => segment.invalidations.includes("template:v3"))
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agentsy/core test packages/core/src/context/contextSegments.test.ts -v`
Expected: FAIL because `buildContextSegments` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ContextSegment {
  content: string;
  fingerprint: {
    value: string;
    modelFamily: string;
    templateVersion: string;
    schemaVersion: number;
  };
  reuseClass: "hot" | "warm" | "cold";
  invalidations: string[];
}

export interface BuildContextSegmentsInput {
  systemPrompt: string;
  toolSchema?: unknown;
  memorySummary?: string;
  modelFamily: string;
  templateVersion: string;
}

export function buildContextSegments(
  input: BuildContextSegmentsInput
): ContextSegment[] {
  return [
    {
      content: input.systemPrompt,
      fingerprint: {
        value: `systemPrompt:${input.modelFamily}:${input.templateVersion}`,
        modelFamily: input.modelFamily,
        templateVersion: input.templateVersion,
        schemaVersion: 1,
      },
      reuseClass: "hot",
      invalidations: [
        `model-family:${input.modelFamily}`,
        `template:${input.templateVersion}`,
      ],
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agentsy/core test packages/core/src/context/contextSegments.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/context/contextSegments.ts packages/core/src/context/contextSegments.test.ts packages/core/src/index.ts packages/core/src/structured/providerFormats.ts
git commit -m "feat(core): add cache-aware context segments"
```

## Task 3: Persist reuse metadata in session snapshots

**Files:**

- Modify: `packages/session/src/core/session.ts`
- Modify: `packages/session/src/core/manager.ts`
- Modify: `packages/session/src/core/store.ts`
- Test: `packages/session/src/core/session-cache.test.ts`
- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createSessionSnapshot } from "./session.js";

describe("session cache metadata", () => {
  it("stores reusable context fingerprints and invalidation keys", () => {
    const snapshot = createSessionSnapshot({
      sessionId: "session-1",
      modelFamily: "qwen",
      reusableSegments: [
        {
          fingerprint: "systemPrompt:qwen:v3",
          reuseClass: "hot",
          invalidations: ["model-family:qwen", "template:v3"],
        },
      ],
    });

    expect(snapshot.state.reusableSegments?.[0]?.reuseClass).toBe("hot");
    expect(snapshot.state.modelFamily).toBe("qwen");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agentsy/session test packages/session/src/core/session-cache.test.ts -v`
Expected: FAIL because `createSessionSnapshot` does not accept reusable segment metadata yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ReusableSessionSegment {
  fingerprint: string;
  reuseClass: "hot" | "warm" | "cold";
  invalidations: string[];
}

export interface SessionState {
  // existing fields
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
}

export function createSessionSnapshot(input: {
  sessionId: string;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
}) {
  return {
    sessionId: input.sessionId,
    timestamp: new Date(),
    checksum: "placeholder",
    schemaVersion: 1,
    state: {
      modelFamily: input.modelFamily,
      reusableSegments: input.reusableSegments,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agentsy/session test packages/session/src/core/session-cache.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/session/src/core/session.ts packages/session/src/core/manager.ts packages/session/src/core/store.ts packages/session/src/core/session-cache.test.ts
git commit -m "feat(session): persist reusable context metadata"
```

## Task 4: Add cache-aware memory retrieval behavior

**Files:**

- Modify: `packages/memory/src/retrieval/index.ts`
- Modify: `packages/memory/src/store/index.ts`
- Test: `packages/memory/src/retrieval/cache-aware-retrieval.test.ts`
- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { rankReusableMemoryBlocks } from "./index.js";

describe("rankReusableMemoryBlocks", () => {
  it("prefers hot reusable blocks with matching fingerprints", () => {
    const ranked = rankReusableMemoryBlocks(
      [
        {
          fingerprint: "systemPrompt:qwen:v3",
          reuseClass: "hot",
          hitCount: 9,
          invalidations: [],
        },
        {
          fingerprint: "systemPrompt:qwen:v2",
          reuseClass: "cold",
          hitCount: 1,
          invalidations: ["template:v2"],
        },
      ],
      "systemPrompt:qwen:v3"
    );

    expect(ranked[0]?.fingerprint).toBe("systemPrompt:qwen:v3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agentsy/memory test packages/memory/src/retrieval/cache-aware-retrieval.test.ts -v`
Expected: FAIL because `rankReusableMemoryBlocks` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function rankReusableMemoryBlocks(
  blocks: Array<{
    fingerprint: string;
    reuseClass: "hot" | "warm" | "cold";
    hitCount: number;
    invalidations: string[];
  }>,
  fingerprint: string
) {
  return [...blocks]
    .filter((block) => !block.invalidations.includes(fingerprint))
    .sort((a, b) => {
      if (a.fingerprint === fingerprint && b.fingerprint !== fingerprint)
        return -1;
      if (b.fingerprint === fingerprint && a.fingerprint !== fingerprint)
        return 1;
      return b.hitCount - a.hitCount;
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agentsy/memory test packages/memory/src/retrieval/cache-aware-retrieval.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/memory/src/retrieval/index.ts packages/memory/src/store/index.ts packages/memory/src/retrieval/cache-aware-retrieval.test.ts
git commit -m "feat(memory): add cache-aware reuse ranking"
```

## Task 5: Wire runtime reuse decisions into context assembly

**Files:**

- Modify: `packages/runtime/src/*` relevant context assembly entrypoints
- Modify: `packages/runtime/src/loop/*` relevant request preparation code
- Test: `packages/runtime/src/cache-aware-context.test.ts`
- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildRuntimeContext } from "./cache-aware-context.js";

describe("buildRuntimeContext", () => {
  it("reuses cached segments when fingerprints still match", () => {
    const context = buildRuntimeContext({
      modelFamily: "qwen",
      templateVersion: "v3",
      reusableSegments: [
        {
          fingerprint: "systemPrompt:qwen:v3",
          reuseClass: "hot",
          invalidations: [],
        },
      ],
    });

    expect(context.reusedSegments).toContain("systemPrompt:qwen:v3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agentsy/runtime test packages/runtime/src/cache-aware-context.test.ts -v`
Expected: FAIL because `buildRuntimeContext` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildRuntimeContext(input: {
  modelFamily: string;
  templateVersion: string;
  reusableSegments: Array<{
    fingerprint: string;
    reuseClass: "hot" | "warm" | "cold";
    invalidations: string[];
  }>;
}) {
  return {
    reusedSegments: input.reusableSegments
      .filter((segment) => segment.reuseClass !== "cold")
      .map((segment) => segment.fingerprint),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agentsy/runtime test packages/runtime/src/cache-aware-context.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/cache-aware-context.test.ts packages/runtime/src/cache-aware-context.ts packages/runtime/src/loop/*
git commit -m "feat(runtime): wire cache-aware context reuse"
```

## Task 6: Update package docs and master plan for cache-aware reuse

**Files:**

- Modify: `packages/memory/IMPLEMENTATION-PLAN.md: existing sections`
- Modify: `packages/core/IMPLEMENTATION-PLAN.md: existing sections`
- Modify: `packages/session/IMPLEMENTATION-PLAN.md: existing sections`
- Modify: `plan/MASTER-IMPLEMENTATION-PLAN.md: existing sections`
- Modify: `TODO.txt: existing checklist`
- [ ] **Step 1: Write the failing test**

```text
No code test here; verify the plan documents mention:
- cache-aware reusable context fingerprints
- hot/warm/cold reuse tiers
- invalidation keys
- session snapshot reuse metadata
```

- [ ] **Step 2: Run the verification command**

Run: `grep -R "cache-aware\|reusable context\|fingerprint\|hot/warm/cold" packages/memory/IMPLEMENTATION-PLAN.md packages/core/IMPLEMENTATION-PLAN.md packages/session/IMPLEMENTATION-PLAN.md plan/MASTER-IMPLEMENTATION-PLAN.md TODO.txt`
Expected: matching lines in all five files.

- [ ] **Step 3: Write minimal implementation**

Add the documentation bullets listed above if any are missing.

- [ ] **Step 4: Run the verification command again**

Run: `grep -R "cache-aware\|reusable context\|fingerprint\|hot/warm/cold" packages/memory/IMPLEMENTATION-PLAN.md packages/core/IMPLEMENTATION-PLAN.md packages/session/IMPLEMENTATION-PLAN.md plan/MASTER-IMPLEMENTATION-PLAN.md TODO.txt`
Expected: matching lines in all five files.

- [ ] **Step 5: Commit**

```bash
git add packages/memory/IMPLEMENTATION-PLAN.md packages/core/IMPLEMENTATION-PLAN.md packages/session/IMPLEMENTATION-PLAN.md plan/MASTER-IMPLEMENTATION-PLAN.md TODO.txt
git commit -m "docs: add cache-aware context reuse plan"
```

## Self-Review

**1. Spec coverage:**

- Memory cache metadata: Task 1
- Core context assembly: Task 2
- Session resume metadata: Task 3
- Cache-aware memory retrieval: Task 4
- Runtime reuse decisions: Task 5
- Documentation and roadmap alignment: Task 6

**2. Placeholder scan:**

- No placeholder-only steps remain.
- Every implementation step includes actual code or a concrete command.

**3. Type consistency:**

- `ContextFingerprint`, `MemoryReuseHint`, `ContextSegment`, `ReusableSessionSegment`, and `buildRuntimeContext()` are introduced before later tasks reference them.
- Cache metadata fields are consistent across memory, core, and session plan items.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-cache-aware-context-reuse.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
