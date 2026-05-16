# @agentsy Monorepo — Comprehensive Audit Remediation Plan

> **Status**: Awaiting approval. No fixes have been implemented.  
> **Audit date**: 2025-07-26  
> **Scope**: Full codebase audit — build errors, test failures, architectural gaps vs. plan documents.

---

## Executive Summary

| Category | Count | Severity |
|---|---|---|
| Build-blocking type errors | 5 (in 2 packages) | CRITICAL |
| Failing tests | 18 (across 4 packages) | HIGH |
| Cascade build failures (downstream of runtime) | 4 packages | HIGH |
| Architectural gaps vs. plan | 3 items | MEDIUM |
| Build warnings (unused imports) | 3 imports | LOW |
| Packages with no tests | 3 packages | LOW |

**Healthy packages** (build + tests pass): `@agentsy/types`, `@agentsy/tokens`, `@agentsy/providers`, `@agentsy/models`, `@agentsy/plugins`, `@agentsy/retrieval`, `@agentsy/ui`, `@agentsy/connectors`, `@agentsy/guardrails`, `@agentsy/mcp`  
**Passing test total**: 280+ of ~298 tests

---

## Section 1 — CRITICAL: Build-Blocking Type Errors

Fixing these first unblocks the cascade failures in 4 downstream packages and restores `pnpm check-types` to green.

### 1.1 — `@agentsy/vscode` (2 errors, TS2554)

Both errors are missing a required second argument to an event-emitter function.

**Error A** — `src/api-key-manager/api-key-manager.ts:103`

```text
error TS2554: Expected 2 arguments, but got 1.
  this.notifyListeners("deleted")
```

**Fix**: Add `undefined` as second argument.

```typescript
// Before
this.notifyListeners("deleted");

// After
this.notifyListeners("deleted", undefined);
```

**Error B** — `src/testing/mock-builders.ts:36`

```text
error TS2554: Expected 2 arguments, but got 1.
  emit("deleted")
```

**Fix**: Add `undefined` as second argument.

```typescript
// Before
emit("deleted");

// After
emit("deleted", undefined);
```

---

### 1.2 — `@agentsy/runtime` (3 errors; blocks 4 downstream packages)

This package's `check-types` failure cascades to: `@agentsy/memory`, `@agentsy/testing`, `@agentsy/renderers`, `@agentsy/tools`.

**Error A & B** — `src/ag-ui/observable.ts:94` and `src/ag-ui/observable.ts:103` (TS2554)

```text
error TS2554: Expected 1 arguments, but got 0.
  await generator.return?.();   // line 94
  void generator.return?.();    // line 103
```

Root cause: TypeScript's built-in `AsyncGenerator` interface declares `return(value: TReturn | PromiseLike<TReturn>)` with the value argument as **required** (no `?`). Optional chaining (`?.`) only gates whether the method exists — it does not make the method's own parameters optional.

**Fix**: Pass `undefined` as the value argument.

```typescript
// Before
await generator.return?.();   // line 94
void generator.return?.();    // line 103

// After
await generator.return?.(undefined);   // line 94
void generator.return?.(undefined);    // line 103
```

**Error C** — `src/sandbox/virtual/container-detector.test.ts:8` (TS2769)

```text
error TS2769: No overload matches this call.
  vi.mock("node:fs", () => ({ constants: { F_OK: 0 } }))
```

Root cause: The `vi.mock` factory return type is inferred against the full `typeof import("node:fs")` shape, which requires many properties beyond `constants.F_OK`. TypeScript can't unify the stub with the full module shape.

**Fix**: Use `vi.importActual` to spread the real module and override only the properties needed.

```typescript
// Before
vi.mock("node:fs", () => ({ constants: { F_OK: 0 } }));

// After
vi.mock("node:fs", async () => ({
  ...(await vi.importActual<typeof import("node:fs")>("node:fs")),
  constants: { F_OK: 0 },
}));
```

---

## Section 2 — HIGH: Test Failures (18 total)

Three distinct root-cause patterns account for all 18 failures.

### Pattern A — `toHaveBeenCalledWith()` zero-args misuse (7 failures)

**Diagnosis**: Calling `.toHaveBeenCalledWith()` with **zero arguments** asserts the spy was called with **zero arguments**. In every failing case, the spy is called with one or more arguments at runtime, so the assertion always fails.

Confirmed error message: `AssertionError: expected "vi.fn()" to be called with arguments: []`

**Affected files**:

| Package | File | Count |
|---|---|---|
|---|---|---|
| `@agentsy/core` | `src/processor/processor/LLMStreamProcessor.test.ts` | 1 |
| `@agentsy/renderers` | `src/shared.test.ts:315` | 1 |
| `@agentsy/renderers` | `src/cli/cli.test.ts` | 4 |
| `@agentsy/memory` | `src/coordination/pub-sub-manager.test.ts` | 1 |

**Fix**: Replace `.toHaveBeenCalledWith()` (zero-args) with `.toHaveBeenCalled()` (any-args). Where the test should assert specific argument values, supply the correct expected arguments instead.

```typescript
// Before (wrong — asserts called with zero args)
expect(spy).toHaveBeenCalledWith();

// After — option 1: just verify it was called
expect(spy).toHaveBeenCalled();

// After — option 2: verify specific args (more precise)
expect(spy).toHaveBeenCalledWith("expected arg value");
```

---

### Pattern B — `toStrictEqual` on null-prototype objects (10 failures)

**Diagnosis**: `extractXmlToolCalls.ts` constructs the `parameters` field on `XmlToolCall` objects as a **null-prototype object**:

```typescript
const parameters = Object.assign(Object.create(null), args) as JsonObject;
```

`Object.create(null)` creates an object with no `Object.prototype` chain. `toStrictEqual` performs a strict deep equality check that includes prototype chain comparison. A plain object literal `{}` has `Object.prototype`, so it can never strictly equal a null-prototype object with the same properties — even though `toStrictEqual`'s diff output shows "Compared values have no visual difference".

Confirmed error message: `AssertionError: expected { path: 'package.json' } to strictly equal { path: 'package.json' }`

**Affected files**:

| Package | File | Failing tests |
|---|---|---|
| `@agentsy/core` | `src/processor/processor/LLMStreamProcessor.test.ts` | 2 |
| `@agentsy/testing` | `src/thinking-and-tool-calls.test.ts` | 6 |
| `@agentsy/testing` | `src/renderers.test.ts` | 1 |
| `@agentsy/testing` | `src/sse-pipeline.test.ts` | 1 |

**Fix options** (choose one per test):

```typescript
// Option 1: toMatchObject — checks shape only, ignores prototype
expect(result.parameters).toMatchObject({ path: "package.json" });

// Option 2: toEqual — deep equality ignoring prototype (recommended for most cases)
expect(result.parameters).toEqual({ path: "package.json" });

// Option 3 (if implementation should be fixed): Change extractXmlToolCalls.ts
// to produce a plain object instead of null-prototype object.
// Trade-off: null-prototype prevents prototype pollution attacks on parsed parameters.
// DO NOT use toStrictEqual against these objects in tests unless you construct
// the expected value the same way.
```

**Recommendation**: Use `toEqual` in tests (leaves the security-conscious null-prototype design in place).  
**Alternative**: If XmlToolCall.parameters being null-prototype is unintentional, change `extractXmlToolCalls.ts` to `Object.assign({}, args)` and leave `toStrictEqual`.

---

### Pattern C — `expect(promise).not.toThrow()` misuse (1 failure)

**Diagnosis**: `not.toThrow()` requires a **synchronous function** as its subject. Passing a `Promise` directly causes the assertion to either pass vacuously or fail unexpectedly because it inspects a Promise object, not a function invocation.

**Affected file**: `@agentsy/memory src/coordination/honker/loader.test.ts` — "should not throw on missing file access"

**Fix**:

```typescript
// Before (wrong — passes a Promise to not.toThrow())
expect(loadHonkerExtension(options)).not.toThrow();

// After — option 1: wrap in a function for synchronous-style assertion
await expect(() => loadHonkerExtension(options)).resolves.not.toThrow();

// After — option 2: use resolves matcher directly
await expect(loadHonkerExtension(options)).resolves.toBeDefined();
```

---

## Section 3 — MEDIUM: Architectural Gaps vs. Plan Documents

### Gap 1 — Plan "validation gates" are stale

`plan/IMPLEMENTATION-PRIORITY.md` and the Phase completion docs (`PHASE-1-COMPLETION.md` through `PHASE-4-COMPLETION.md`) state as validation criteria:

> Validation: `packages/memory` tests and typecheck pass; monorepo `pnpm check-types` + `pnpm test` pass

**Current reality**: Both gates are failing.

- `pnpm check-types` exits non-zero (5 type errors in 2 packages)
- `pnpm test` has 18 failing tests across 4 packages

The plan docs accurately reflected the state at the time they were written. Subsequent changes to `@agentsy/vscode`, `@agentsy/runtime`, and test files introduced the regressions without updating the plan docs.

**Remediation**: After all type errors and test failures are fixed (Sections 1 & 2 above), update the validation status in the relevant plan docs to reflect the restored green state. Add a CI gate that enforces `pnpm check-types` and `pnpm test` pass on every commit.

---

### Gap 2 — Phase 3/4 not implemented, plan docs claim phase 2 is the current frontier

`plan/IMPLEMENTATION-PRIORITY.md` marks Phase 3 and 4 as explicitly not started:

- **Phase 3**: mcp-rag-server integration (RAG enhancement) — NOT implemented
- **Phase 4**: AgentFS, content addressing, virtual sandbox federation — NOT implemented

`@agentsy/mcp` exists as a package but contains only `index.ts` and `types.ts` stubs. This is consistent with the plan — Phase 3 work has not begun.

**No action required on this gap** unless Phase 3/4 development is being started now. Document-only note: the plan docs accurately reflect this status.

---

### Gap 3 — `@agentsy/guardrails` is an empty stub with no tests

`packages/guardrails/src/index.ts` is a stub. The package passes `pnpm test` only because `--passWithNoTests` is active. There is no implementation, no test file, and no roadmap entry describing intended functionality.

**Recommendation**: Either (a) document the intended scope in a plan file and track it as a future work item, or (b) remove the package from the workspace until implementation begins, to avoid false completeness signals.

---

## Section 4 — LOW: Build Warnings

### 4.1 — Unused imports in `@agentsy/core src/formatting/`

tsup emits warnings during build:

```text
"fs/promises" is imported by src/formatting/... but never used
"path" is imported by src/formatting/... but never used
"crypto" is imported by src/formatting/... but never used
```

**Fix**: Remove the three unused imports from the affected formatting file(s).

---

## Section 5 — LOW: Packages with No Tests

Three packages currently pass only because of `--passWithNoTests`:

| Package | Has source | Status |
|---|---|---|
| `@agentsy/connectors` | Yes (`discord.ts`, `slack.ts`, `telegram.ts`) | Real impl, zero tests |
| `@agentsy/guardrails` | Stub only | Stub, zero tests |
| `@agentsy/mcp` | Minimal (`index.ts`, `types.ts`) | Partial impl, zero tests |

**Recommendation**: Add at least smoke-level unit tests to `@agentsy/connectors` given it has real implementation code. Flag `@agentsy/guardrails` and `@agentsy/mcp` as stubs until Phase 3/4 work begins.

---

## Recommended Fix Order

Apply in this sequence to unblock the most packages at each step:

1. **Fix `@agentsy/runtime` type errors** (1.2 above) — unblocks `memory`, `testing`, `renderers`, `tools` check-types
2. **Fix `@agentsy/vscode` type errors** (1.1 above) — restores the only published package to green
3. **Fix `toHaveBeenCalledWith()` zero-args across all packages** (2 / Pattern A) — 7 tests, 4 packages; trivial grep-and-replace
4. **Fix `toStrictEqual` null-prototype failures** (2 / Pattern B) — 10 tests, 2 packages; change `toStrictEqual` → `toEqual`
5. **Fix `expect(promise).not.toThrow()` in memory** (2 / Pattern C) — 1 test
6. **Remove unused imports in core formatting** (4.1)
7. **Update plan docs and validate CI gates** (3.1)
8. **Address stub packages** (3.3, Section 5) — lower priority

After steps 1–5, `pnpm check-types` and `pnpm test` should be fully green.

---

## Validation Criteria for Completion

```bash
# All of these must exit 0:
pnpm check-types
pnpm test
pnpm build
```

Expected final state:

- 0 type errors
- 0 failing tests (298/298 pass)
- 0 build failures
- `@agentsy/vscode` publishes clean

---

*End of remediation plan.*
