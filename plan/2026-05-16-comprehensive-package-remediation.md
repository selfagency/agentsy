# Comprehensive Package Remediation Plan

![Status: Draft](https://img.shields.io/badge/status-Draft-yellow)

This plan outlines a systematic, dependency-aware remediation approach for all 20 packages in the Agentsy monorepo, ranked from easiest to hardest. The goal is zero errors across type checking, linting, and testing.

**Last Updated**: 2026-05-16
**Total Packages**: 20
**Estimated Total Fixes**: ~150+ type errors, ~1,500+ lint errors, ~150+ test failures

---

## Executive Summary

| Category | Current Status | Target |
|----------|----------------|---------|
| Packages Passing | 8 (40%) | 20 (100%) |
| Type Error Packages | 13 | 0 |
| Lint Error Packages | 11 | 0 |
| Test Failing Packages | 8 | 0 |

### Root Cause Analysis

Most issues stem from 4 critical packages that form the foundation:

1. **memory** - Syntax errors blocking tools
2. **core** - Type safety issues affecting 8+ dependents
3. **renderers** - Missing type declarations
4. **runtime** - Enum redefinition causing 87 test failures

---

## Package Remediation Ranks

The packages are ranked by remediation difficulty (1 = trivial, 5 = major refactoring) and tackled in dependency order.

### Tier 1: Quick Wins** (Difficulty: 1/5)

These are pass-or-fail issues that can be fixed in minutes each.

### **Package 1: prompts** ✅ **ALREADY PASSING**
- **Status**: No issues detected
- **Action**: Mark as healthy, move on

### **Package 2: observability** 🟢 **DONE (add tests if desired)**
- **Status**: Type check ✅, Lint ✅, Tests (none)
- **Issues**: None
- **Fix**: Optionally add test coverage for 7 source files
- **Estimated Time**: ~15 minutes

### **Package 3: guardrails** 🟢 **DONE (add tests if desired)**
- **Status**: Type check ✅, Lint ✅, Tests (none)
- **Issues**: None
- **Fix**: Add test coverage for 3 source files
- **Estimated Time**: ~10 minutes

### **Package 4: mcp** 🟢 **DONE (add tests if desired)**
- **Status**: Type check ✅, Lint ✅, Tests (none)
- **Issues**: None
- **Fix**: Add test coverage for 4 source files
- **Estimated Time**: ~10 minutes

### **Package 5: models** 🟢 **ADD CHECK-TYPES SCRIPT**
- **Status**: Lint ✅, Tests ✅, check-types missing
- **Issues**: Missing `check-types` script from package.json
- **Fix**: Add `"check-types": "tsc --noEmit"` to scripts section
- **Estimated Time**: ~2 minutes

### **Package 6: memory** 🔴 **CRITICAL BUT EASY FIX**
- **Status**: 57 type errors, 33 lint errors, 8 test failures
- **Root Cause**: `isObject()` helper function defined outside class scope
- **File**: `packages/memory/src/sync/file-conflict-store.ts:88`
- **Fix**:
  ```typescript
  // Move isObject function from outside class
  // to inside the ConflictTracker class as a private method
  ```
- **Impact**: Unblocks tools package + fixes cascading failures
- **Estimated Time**: ~5 minutes

**Tier 1 Completion**: 3 packages fixed, 2 more passing

---

### Tier 2: Easy/Medium Fixes** (Difficulty: 2/5)

Small but meaningful fixes requiring code changes.

### **Package 7: tools** 🔴 **UNBLOCKED BY MEMORY**
- **Status**: 56+ type errors, Lint ✅, Tests ✅
- **Root Cause**: Type checker checking wrong build path
- **Fix**: Fix TypeScript config/project references to check `tools` instead of memory
- **Estimated Time**: ~10 minutes (after memory is fixed)

### **Package 8: core** 🔴 **FOUNDATIONAL - HIGHEST PRIORITY**
- **Status**: 4 type errors, 220 lint errors, 4 test failures
- **Type Errors**:
  - `packages/core/src/structured/validateJsonSchema.ts:429:9` - object → Record<string, unknown>
  - `packages/core/src/tool-calls/providerToolsContract.ts:47:9` - object → Record<string, unknown>
  - 2 more similar issues throughout the codebase
- **Lint Errors**: 220 type safety violations:
  - Unsafe assignments from unknown/error types
  - Unnecessary type assertions (`as`)
  - Usage of `any` types
  - Missing async in callback functions
- **Test Failures**: 4 failures in `LLMStreamProcessor.test.ts`:
  - Thinking tag processing
  - Event emission
  - Fragmented JSON handling
- **Fix**:
  1. Add explicit `Record<string, unknown>` type annotations
  2. Replace unsafe type assignments with proper typing
  3. Investigate and fix processor integration tests
- **Impact**: Fixes cascading type errors across 8+ dependent packages
- **Estimated Time**: ~2-3 hours

### **Package 9: scripts** 🟡 **ESM MIGRATION**
- **Status**: 206 lint errors, Tests ✅ (36 passed)
- **Issues**:
  - 42 CommonJS violations (`require()` → `import`)
  - 58 unsafe `JSON.parse()` calls without proper typing
  - 59 unsafe type assertions
  - 12 promises in void contexts (signal handlers)
- **Fix**:
  1. Migrate all `require()` to ES6 `import` statements
  2. Add proper typing for `JSON.parse()` results
  3. Replace unsafe `as` assertions with proper types or restructure code
  4. Fix promise handlers to handle async properly
- **Estimated Time**: ~2 hours

**Tier 2 Completion**: Core foundation fixed, unblocks 8+ downstream packages

---

### Tier 3: Medium Refactoring** (Difficulty: 3/5)

Moderate-level structural and API changes.

### **Package 10: cli** 🟡
- **Status**: 1 type error, 4 lint errors, 1 test failure
- **Type Error**: Missing `@agentsy/core/context` declaration
- **Lint Errors**: 4 unsafe operations on error-typed values
- **Test Failure**: `src/commands.perf.test.ts:67` - Expected output length > 0 but got 0
- **Dependencies**: Blocked until core package exports are fixed
- **Fix**:
  1. Will be unblocked when core exports type declarations
  2. Investigate why perf test returns empty array
- **Estimated Time**: ~30 minutes (after core fixed)

### **Package 11: retrieval** 🟠 **IMPLEMENTATION NEEDED**
- **Status**: 10 type errors, 138 lint errors, 13 test failures
- **Root Cause**: `RetrievalEngine` class missing methods that tests expect
- **Type Errors**:
  - Methods not found: `keywordSearch`, `vectorSearch`, `hasDoc`
  - Return type safety issues: unknown → number conversions
  - 1 syntax error: extra )); at `packages/retrieval/__tests__/export-contracts.test.ts:187`
- **Test Failures**: 12 tests calling non-existent methods + 2 async resolution issues
- **Fix**:
  1. Implement `keywordSearch()`, `vectorSearch()`, `hasDoc()` methods
  2. Add proper return type annotations (Promise<number>).
  3. Fix syntax error in test file
  4. Fix async method signatures
- **Estimated Time**: ~3 hours

### **Package 12: providers** 🟠 **API UPGRADES**
- **Status**: 13 type errors, 149 lint errors, Tests ✅ (123 passed)
- **Type Errors**:
  - 7 missing core module type declarations:
    - `@agentsy/core/processor`
    - `@agentsy/core/structured`
    - `@agentsy/core/tool-calls`
  - 6 missing `PipelineOptions` properties:
    - `modelId`
    - `parseThinkTags`
    - `scrubContextTags`
    - `extraScrubTags`
    - `knownTools`
- **Lint Errors**: 149 unsafe operations on error-typed values
- **Dependencies**: Blocked until core package exports are fixed
- **Fix**:
  1. Will be unblocked when core exports are fixed
  2. Add missing properties to `PipelineOptions` interface
  3. Fix unsafe type operations throughout adapters
- **Estimated Time**: ~2 hours (after core fixed)

**Tier 3 Completion**: All core-dependent packages fixed

---

### Tier 4: Medium/Hard** (Difficulty: 4/5)

Significant work with extensive changes.

### **Package 13: ui** 🔴 **PROCESSOR API INTEGRATION**
- **Status**: 2 type errors, 19 lint errors, Tests ✅ (22 passed)
- **Type Errors**: 2 missing `@agentsy/core/processor` declarations
- **Lint Errors**: 19 unsafe operations:
  - `processor.on()` / `processor.off()` calls on error-typed instances
  - Unsafe constructor usage
  - Unsafe method calls on untyped processors
- **Files Affected**: `packages/ui/src/processorBridge.ts`, `packages/ui/src/ui.test.ts`
- **Dependencies**: Blocked until core exports are fixed
- **Fix**:
  1. Will be unblocked when core exports type declarations
  2. Add type guards before processor API calls
  3. Fix unsafely typed processor method invocations
- **Estimated Time**: ~1 hour (after core fixed)

### **Package 14: testing** 🟠 **COMPLEX DEPENDENCIES**
- **Status**: 7 type errors, 45 lint errors, 8 test failures
- **Type Errors**: All blocked by dependencies (core, renderers)
- **Lint Errors**: 45 issues:
  - 17 `__dirname` → ESM issues (CommonJ to ES module)
  - 6 missing `async` in callback functions
  - 6 `require-await` violations (async without await)
  - Invalid tsconfig.json path mappings (missing ./ prefix)
- **Test Failures**: 8 object comparison failures (serialization/key ordering)
- **Dependencies**: Blocked until core and renderers are fixed
- **Fix**:
  1. Will be unblocked when dependencies are fixed
  2. Migrate all `__dirname` to ES module alternatives (`import.meta.url`, `fileURLToPath`)
  3. Fix tsconfig.json path mappings (add ./ prefix)
  4. Debug/test object serialization (Parameters, tool call lexical construction)
- **Estimated Time**: ~3 hours

**Tier 4 Completion**: All non-blocking packages fixed

---

### Tier 5: Hard Refactoring** (Difficulty: 5/5)

Major architectural and type system overhauls.

### **Package 15: runtime** 🔴 **ENUM OVERHAULD**
- **Status**: 7 type errors, 328 lint errors, 87 test failures
- **Type Errors**:
  - 1 error: Invalid `vi.mock` overload in container-detector.test.ts:8
  - 6 errors: MessagePort missing 'location' property in `sandbox-worker.ts:17,20`
- **Lint Errors**: 328 issues:
  - ~150 unsafe type assertions (`as Record<string, unknown>`)
  - Unsafe enum comparisons
  - Unbound method warnings
  - Strict void return violations
  - Incomplete switch cases
  - Many unsafe assignments and member access on error-typed values
  - Incorrect compare to boolean literals
- **Test Failures**: 87 failures due to undefined enums:
  - `EventType.RUN_STARTED` undefined
  - Similar issues with other Event 定量
- **Root Cause**: Enum redefinition, import/export mismatch, or namespace issue
- **Fix Plan**:
  1. Investigate enum export/import issue in core package
  2. Add explicit type annotations for MessagePort (possibly interface extension)
  3. Address unsafe type assertions systematically 1:1 with fixes
  4. Verify enum availability in test context
  5. Fix switch case completeness
  6. Remove or fix unbound method references
- **Estimated Time**: ~4-5 hours

### **Package 16: renderers** 🔴 **INK + TYPES COMPLEXITY**
- **Status**: 30+ type errors, 11 lint errors, 35 test failures
- **Type Errors**: All stemming from missing core type declarations
  - `@agentsy/core/formatting` declaration not found
  - `@agentsy/core/processor` declaration not found
  - Import statements failing with TS7016
- **Lint Errors**: 11 issues:
  - `require-await`: Async function with no await expression
  - `unified-signatures`: Overload signatures can be combined
  - `no-empty-object-type`: Should not use empty object borrowed
- **Test Failures**: 35 failures:
  - `src/ink/ink.test.ts`: Ink renderer integration issues
  - `src/cli/cli.test.ts`: CLI renderer integration issues
- **Dependencies**: Blocked until core exports type declarations and ESM is fixed
- **Fix Plan**:
  1. Will be unblocked when core package emits type declarations
  2. Check if core package needs `export *` from submodules
  3. Fix async/Promise signature mismatches in Ink renderers
  4. Fix Ink renderer mock setups and dependencies
  5. Ensure proper ESM imports work in renderers package
- **Estimated Time**: ~3-4 hours (after core fixed)

**Tier 5 Completion**: All packages passing, zero errors baseline achieved

---

## ✅ PHASE EXECUTION PLAN

### Phase 1: Cleanup** (Day 1, ~2 hours)

**Goal**: Fix critical low-hanging fruit and establish momentum

| Package | Challenge | Est. Time | Impact |
|---------|-----------|-----------|---------|
| observability | No errors, add tests | ~15 min | Minimal |
| guardrails | No errors, add tests | ~10 min | Minimal |
| mcp | No errors, add tests | ~10 min | Minimal |
| models | Add check-types script | ~2 min | Low |
| **memory** | Syntax error, easy fix | ~5 min | **HIGH** - unblocks tools |
| **tools** | Wrong build path config | ~10 min | **HIGH** - fixed by memory |

**Expected Results**:
- ✅ 3 packages with comprehensive testing
- ✅ 2 packages fully fixed (memory, tools)
- ✅ 1 package with check-types added (models)
- 🔗 Unblocked 1 downstream dependency
- 📊 Summary: 3 packages improved, 0 failing

---

### Phase 2: Foundation** (Day 2, ~5-6 hours)

**Goal**: Fix core infrastructure to unblock 8+ downstream packages

| Package | Challenge | Est. Time | Impact |
|---------|-----------|-----------|---------|
| **core** | Type safety, tests | ~2-3 hr | **CRITICAL** - unblocks 8+ |
| **scripts** | ESM migration | ~2 hr | Medium |
| **retrieval** | Implement missing methods | ~3 hr | Medium |

**Expected Results**:
- ✅ Core package base fixed (type safety, tests)
- ✅ ESM migration complete for scripts
- ✅ Retrieval engine methods implemented
- 🔗 Unblocked 8+ dependent packages
- 📊 Summary: 3 complex packages fixed, multi-level dependency chain resolved

**Critical Dependencies Fixed**:
1. core type exports → unblocks: cli, providers, ui, testing
2. core tests → validates processor behavior
3. scripts ESM → improves maintainability
4. retrieval implementation → enables search workflows

---

### Phase 3: Dependencies** (Day 3, ~4-5 hours)

**Goal**: Fix all core-dependent packages

| Package | Challenge | Est. Time | Impact |
|---------|-----------|-----------|---------|
| cli | Missing type, test failure | ~30 min | Low |
| providers | API upgrades | ~2 hr | Medium |
| ui | Processor API | ~1 hr | Medium |

**Expected Results**:
- ✅ All 3 core-dependent packages fixed
- ✅ CLI metadata parsing works
- ✅ All adapter patterns cleaned up
- ✅ Processor bridge properly typed
- 📊 Summary: 3 packages fixed, no remaining core blocking issues

---

### Phase 4: Hard Cases** (Day 4-5, ~8-10 hours)

**Goal**: Resolve remaining complex packages

| Package | Challenge | Est. Time | Priority |
|---------|-----------|-----------|----------|
| testing | Complex deps + serialization | ~3 hr | High |
| renderers | Ink + types | ~3-4 hr | **HIGH** |
| runtime | Enum overhaul | ~4-5 hr | **HIGH** |

**Expected Results**:
- ✅ Testing infrastructure ESM migrated
- ✅ Renderers properly typed and tested
- ✅ Runtime enum issues resolved
- ✅ All 20 packages passing
- ✅ Zero lint, type, and test errors

**Final Verification**:
```bash
pnpm check-types  # All pass
pnpm lint          # All pass (0 errors)
pnpm test          # All pass (1000+ tests)
```

---

## 📊 REMEDIATION STATISTICS

### Issue Breakdown by Type

| Error Type | Estimated Count | Est. Hours |
|------------|----------------|------------|
| Missing scripts | 2 | ~1 |
| Syntax errors | ~5 | ~1 |
| Type declaration issues | ~80 | ~10 |
| Type safety violations | ~150 | ~15 |
| Unsafe operations | ~1200 | ~30 |
| Missing implementations | ~15 | ~5 |
| Test failures | ~150 | ~20 |
| Mock/Setup issues | ~50 | ~8 |
| **TOTAL** | **~1,672** | **~90 hours** |

### Complexity Distribution

```
Tier 1 (Quick Wins):     ████████░░░░░░░░░░░░░░░░░░░░░░░ 40% (packages: 6)
Tier 2 (Easy):           ████████░░░░░░░░░░░░░░░░░░░░░░░ 20% (packages: 3)
Tier 3 (Medium):         ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 15% (packages: 3)
Tier 4 (Medium/Hard):    ███░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15% (packages: 2)
Tier 5 (Hard):           ███░░░░░░░░░░░░░░░░░░░░░░░░░░░ 10% (packages: 2)
```

---

## 🎯 SUCCESS METRICS

### Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Packages Passing | 8 (40%) | 20 (100%) |
| Type Errors | 150+ | 0 |
| Lint Errors | 1500+ | 0 |
| Test Failures | 150+ | 0 |
| Passing Tests | ~400 | ~1300+ |
| Zero-Error Baseline | No | Yes |

### Quality Improvements

1. **Type Safety**: Full type coverage with no assertions needed
2. **ESM Adoption**: All packages using modern ES modules
3. **Test Coverage**: All source files tested
4. **Code Quality**: Zero linting violations across codebase
5. **Developer Experience**: Type-checking on every package before commit

---

## 🚀 IMMEDIATE ACTION ITEMS

### Next 30 Minutes (Phase 1 Start)

1. ✅ **Initialize** plan tracking
2. 🎯 **Fix models** → add check-types script
3. 🎯 **Fix memory** → move isObject() function
4. 🎯 **Fix tools** → correct TypeScript config
5. ✅ **Document** progress in each package

### Immediate Next Steps

1. Create GitHub issue with this plan
2. Assign packages (out of scope for first implementation)
3. Start Phase 1 execution
4. Track progress daily in plan folder

---

## 📝 IMPLEMENTATION NOTES

### Decision #1: Package Ordering Strategy
- **Rationale**: Fixed dependencies first (memory → tools → core → dependents)
- **Alternative**: Parallel fixes across all packages (rejected due to cascading dependency issues)
- **Result**: Tiered approach reduces risk of introducing new errors

### Decision #2: Fix Everything vs Truncation
- **Approach**: Fix ALL errors, no silencing of lint rules
- **Rationale**:
  - Linting rules represent real code quality issues
  - Type safety prevents future bugs
  - Test failures indicate missing functionality
  - Zero-error baseline required for production readiness
- **Exception**: Only if rule is fundamentally incompatible with project needs (to be documented and approved)

### Decision #3: API Stability
- **Approach**: NO backward compatibility required (0.1.2 was only release; 0.2.0 is all new)
- **Rationale**:
  - First pre-release (0.1.2) has very limited adoption
  - Full refactor opportunity to align architecture
  - Type system changes are cleaner to implement now
  - No breaking changes needed for existing consumers
- **Impact**: Faster fixes, cleaner APIs, no deprecation cycles

### Decision #4: ESM + Type Safety优先
- **Approach**: Modernize at same time
- **Rationale**:
  - JavaScript APIs are being deprecated
  - Type safety is foundational
  - ESM enables better tooling
- **Implementation**: Addressed systematically in affected packages

---

## 🐛 Known Issues Not in Scope

### Low-Priority Improvements

These are not blocking remediation but could be addressed in follow-up work:

1. Add benchmarking suite to packages that need performance validation
2. Improve JSDoc coverage for public APIs
3. Add integration test suite for multi-package workflows
4. Implement PR templates for new package creation
5. Set up CI quality gates

---

## ✋ CONTINGENCY PLANS

### If Phase 2 (Core) is More Complex

**Indicators**:
- Critical architecture issues discovered in core package
- Extensive enum/type issues requiring major refactoring
- Core package has hidden dependencies on external systems

**Alternative**:
- Scope Phase 2 to core type fixes only (skip test failures)
- Defer renderers runtime issues to separate project
- Reorder: Fix types → Fix tests → Rebuild

### If External Dependencies Block Progress

**Indicators**:
- Tool versions incompatible with TypeScript config
- Package manager locking issues
- Build tooling changes required

**Alternative**:
- Document blocking issues separately
- Create parallel branch for tooling updates
- Resolve dependencies before packaging fixes

---

## 📚 RELATED DOCUMENTS

### Existing Plans
- `UPGRADE-SYSTEM-LINTING-REMEDIALTION-1.md` - Focused on Ultracite/oxlint errors
- `IMPLEMENTATION-PRIORITY.md` - General implementation priorities
- `MASTER-IMPLEMENTATION-PLAN.md` - Overall system architecture plan

### Supporting References
- [TypeScript Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html)
- [Rollup Exports Guide](https://rollupjs.org/guide/en/#exporting-a-functionscope-default)
- [ES Module Compatibility](https://nodejs.org/api/esm.html)
- [Vitest Test Configuration](https://vitest.dev/api/cli.html)

---

## 🎉 FINAL REMEDIATION CHECKLIST

Before declaring success:

- [ ] All 20 packages pass `pnpm check-types`
- [ ] All 20 packages pass `pnpm lint` (0 errors)
- [ ] All 20 packages pass `pnpm test` (100% success rate)
- [ ] No遗漏 blocked by dependencies
- [ ] ESM migration complete for all packages
- [ ] All type declarations properly exported
- [ ] All tests properly configured
- [ ] Codebase follows consistent quality standards
- [ ] Documentation updated (if needed)

**Estimated Timeline**: 5 days with daily progress
**Total Effort**: ~90 engineer-hours
**Success Criteria**: Zero errors across all packages

---

*[End of Plan - Ready for implementation]*