# Stage 1 Lint Error Fix Report

**Date:** 2026-05-16
**Scope:** Priority packages with lint errors

## Summary

| Package   | Initial Errors | Auto-Fixed | Remaining | Status                |
| --------- | -------------- | ---------- | --------- | --------------------- |
| vscode    | 612            | 30 (5%)    | 582       | ⚠️ Needs more work    |
| tokens    | 37             | 0 (0%)     | 37        | ⚠️ Needs manual fixes |
| testing   | 21             | TBD        | TBD       | 🔄 In progress        |
| retrieval | 60 (estimated) | TBD        | TBD       | 📋 Next to process    |

**Total:** 718+ errors across all packages

## Auto-Fix Strategy

### ✅ Successfully Auto-Fixed (30 errors)

**Package:** vscode

- Formatting and basic code organization improvements
- **Note:** Most errors are type safety issues that require manual intervention

### ❌ Cannot Be Auto-Fixed (Complex Issues)

**Common patterns requiring manual fixes:**

1. **Type Safety Issues** (vscode & tokens):
   - `no-unsafe-member-access`: Unsafe access to typed values
   - `no-unsafe-assignment`: Assignment of unsafe values
   - `no-unsafe-call`: Calling unsafe method types
   - `no-unsafe-return`: Returning unsafe values

2. **ESLint Best Practices** (tokens):
   - `no-use-before-define`: Function declarations used before definition
   - `prefer-destructuring`: Should use array/object destructuring
   - `require-await`: Remove unnecessary async keywords
   - `consistent-return`: Missing return statements
   - `no-unnecessary-type-parameters`: Unused type parameters

3. **Missing Dependencies** (tokens):
   - Module resolution: `@agentsy/core/context/compression`

4. **Vitest Configuration** (vscode):
   - Max expectations limit in tests

## Manual Fix Priority

### Priority 1: Quick Wins (Most Impact)

1. **parameters don't fix unsafety** - Type assertions and unsafe operations
2. **no-use-before-define** - Function declaration ordering
3. **prefer-destructuring** - Simplify array/object access
4. **Require-await removal** - Simplify async/await patterns

### Priority 2: Advanced Fixes

1. **Type safety fixes** - Proper type narrowing and assertions
2. **Missing module imports** - Fix dependency resolution
3. **Test configuration** - Update max expectations

## Initial Findings

### vscode (582 remaining)

- **Dominant errors:** Type safety issues (~80%)
- **Files affected:** Mainly test files in `src/vscode-renderer/vscode-renderer.test.ts`
- **Root cause:** Incomplete type definitions on mock objects

### tokens (37 remaining)

- **Dominant errors:** ESLint best practices (~70%)
- **Files affected:** `src/index.ts` (main source file)
- **Root cause:** Legacy code structure and missing optimizations

## Recommendations

1. **Skip Complex Type Repairs First**: The vscode package's type issues are fundamental to its mocking strategy and would require significant testing strategy changes.

2. **Focus on Clean Code Improvements**: The tokens package has clear ESLint violations that are straightforward to fix without changing functionality.

3. **Consider Test Rewrite for vscode**: The high number of type errors in wasm suggests reconsidering test strategy.

4. **Target Small-Batch Fixes**: Given the large number of errors, tackle packages in small batches with confirmation after each.

## Next Steps

1. ✅ Attempted automated lint fixes
2. 📊 Analyzed error patterns
3. ⏳ Work manually on highest-priority ESLint violations
4. 🔄 Move to next package once complete

---

**Status:** Stage 1 partially complete
**Auto-Fixed:** 4.2% total errors
**Requires Manual Work:** 95.8% of total errors
