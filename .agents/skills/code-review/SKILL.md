---
name: code-review
title: Exhaustive Code Review Skill
description: "Conduct comprehensive code reviews addressing syntactical and programmatic correctness, data flow, type safety (zero `any`), performance, security, API conformity, documentation consistency, best practices, and code style. Produces an exhaustively detailed remediation plan before implementing any fixes."
---

<!-- markdownlint-disable MD025 MD060 -->

# Exhaustive Code Review Skill

This skill guides agents through a systematic, rigorous code review process that produces a detailed remediation plan before any changes are proposed. It is designed to catch issues across correctness, typing, performance, security, API design, documentation, and codebase consistency.

## When to use this skill

Use this skill when you need to:

- Review a pull request or branch for merge readiness
- Review code changes against repository standards
- Ensure no `any` types leak into the codebase
- Validate API conformity and consistency
- Identify performance or security implications
- Verify documentation completeness
- Assess risk before merging to main/develop

## Core principles

- **Be exhaustive, not quick.** Trace every code path, every data flow, every type constraint.
- **Produce a plan first.** Never propose fixes without first documenting all issues, severity, and ordering.
- **Zero `any` tolerance.** Treat `any` as a defect unless there is explicit, strong justification.
- **Repo-specific guidance.** Consult project conventions, existing patterns, and repository instructions.
- **Conservative assessment.** If something might be wrong, flag it; do not assume it is fine.
- **No implementation until approval.** Wait for explicit instruction to apply any fixes.

## Review dimensions

### 1. Syntactical Correctness

**What to check:**

- Valid syntax for the language/framework (TS, JS, React, etc.)
- Proper imports and exports
- Correct module resolution (ESM vs CJS)
- Proper destructuring and spread operators
- Valid JSX/TSX if applicable
- Balanced braces, parens, brackets

**What to look for:**

- Missing imports or circular imports
- Incorrect extension usage (`.js` in ESM, etc.)
- Malformed object/array literals
- Invalid JSX structure or prop spreading

### 2. Programmatic Correctness

**What to check:**

- Logic errors in conditionals and loops
- Off-by-one errors
- Incorrect operator precedence
- Proper null/undefined coalescing
- Correct use of array methods, string methods, etc.
- Proper async/await usage
- Error handling (try/catch, promise rejection handlers)
- State transitions and control flow

**What to look for:**

- Logic that contradicts the intent (condition reversed, operator wrong)
- Missing or incorrect edge case handling
- Incomplete error handling or silent failures where they should fail loudly
- Race conditions or timing issues
- Incorrect async patterns (missing await, unhandled promises)

### 3. Data Flow Correctness

**What to check:**

- Data flows through functions, modules, and services correctly
- No unexpected mutations of input data
- Proper immutability where required
- Correct function parameter passing
- Proper return values and side effects
- Event flow and callbacks are chained correctly
- Stream/chunk handling is correct (buffering, flushing, end signals)

**What to look for:**

- Data passed to wrong function
- Data transformed or mutated unexpectedly
- Missing intermediate steps in a pipeline
- Incorrect filtering, mapping, or reducing
- Events emitted but never received or handled
- Incomplete or out-of-order stream operations

### 4. Type Correctness and Flow

**What to check:**

- All variables and function parameters are properly typed
- Return types match function signatures
- Generic types are correctly instantiated
- Union types and discriminated unions are used correctly
- Optional (`?`) vs required fields are appropriate
- Type guards and narrowing work correctly
- No `any` types (or minimal with explicit justification)
- Null/undefined handling aligns with type definitions

**What to look for:**

- `any` types that could be replaced with `unknown`, generics, or explicit types
- Type mismatches between function calls and definitions
- Missing type annotations where inference is insufficient
- Incorrect optional chaining (`?.`) or nullish coalescing (`??`) usage
- Type guards that don't actually narrow the type correctly
- Unsafe type assertions (`as`) that bypass type checking

### 5. Performance Issues

**What to check:**

- Unnecessary allocations (objects, arrays, closures created in loops)
- Repeated work that should be cached or memoized
- N+1 queries or request patterns
- Blocking operations on the main thread
- Inefficient algorithms (nested loops, quadratic complexity)
- Render churn or unnecessary re-renders (React)
- Memory leaks from event listeners, timers, or closures
- Inefficient data structure choices
- Avoidable I/O or network calls

**What to look for:**

- Objects/arrays created inside loops or on every render
- Expensive operations in hot paths without caching
- Multiple queries where one join would suffice
- Synchronous I/O or CPU-bound work on event loop
- Large bundles or inefficient module loading
- DOM operations in tight loops
- Event listeners not cleaned up
- Circular references or detached DOM nodes

### 6. Security Vulnerabilities

**What to check:**

- Input validation and sanitization
- Output encoding (XSS prevention)
- Authentication and authorization (authn/authz)
- Secrets handling (no hardcoded secrets, secure storage)
- SQL injection risks (use parameterized queries)
- Path traversal vulnerabilities
- SSRF (Server-Side Request Forgery)
- CSRF (Cross-Site Request Forgery) protection
- Privilege escalation risks
- Insecure deserialization
- Unsafe defaults (permissive CORS, etc.)
- Cryptographic key management
- Session security and hijacking prevention

**What to look for:**

- String concatenation in SQL queries
- Direct use of user input in file paths
- Missing CSRF tokens on state-changing operations
- Overly broad permissions or missing access checks
- Secrets in environment variables without proper masking
- User input reflected in HTML without encoding
- Deserialization of untrusted data
- Weak or hard-coded encryption keys

### 7. API Conformity and Consistency

**What to check:**

- Own API naming conventions are consistent (verbs for functions, nouns for types, etc.)
- Request/response shapes follow established patterns
- Error semantics match repository standards
- HTTP status codes (if applicable) are correct
- Pagination patterns are consistent
- Idempotency is handled where needed
- Versioning strategy is clear
- Backward compatibility is maintained
- Public APIs match their documentation
- External API conventions are followed correctly

**What to look for:**

- Inconsistent naming (camelCase vs snake_case, verb placement)
- Response shape deviates from repository patterns
- Error messages lack context or are inconsistent
- Wrong HTTP status codes (e.g., 500 instead of 4xx)
- Pagination logic differs between endpoints
- Breaking changes without deprecation warnings
- Public APIs that contradict existing patterns
- Undocumented API changes or behavior

### 8. Documentation Consistency

**What to check:**

- Public APIs are documented (JSDoc, comments)
- README reflects new features or breaking changes
- CHANGELOG is updated if applicable
- Inline comments explain WHY, not WHAT
- Behavior changes are documented
- Migration notes for breaking changes are provided
- Examples match the actual API
- Edge cases and limitations are documented
- Test coverage demonstrates API usage

**What to look for:**

- Public functions without parameter or return type documentation
- New features not mentioned in README or docs
- Code comments that restate the code instead of explaining intent
- Examples that don't match the actual function signature
- Undocumented breaking changes
- Missing JSDoc for exported symbols
- Behavior documented inconsistently across different places

### 9. Best Practices

**What to check:**

- Code follows repository conventions and patterns
- Functions are single-responsibility (SRP)
- No code duplication (DRY principle)
- Proper use of error handling patterns
- Appropriate use of assertions and guards
- Resilience to malformed or adversarial input
- Silent vs. loud failures are appropriate
- Resource cleanup (connections, listeners, files)
- SOLID principles are respected
- Testing best practices are followed

**What to look for:**

- Copy-pasted code that should be extracted
- Functions that do multiple unrelated things
- Brittle error handling (silent failures that should error)
- Functions that assume input is valid without checks
- Resources not cleaned up (connections, listeners, timers)
- Violation of established patterns in the repository
- Missing tests for critical code paths
- Overly complex conditional logic

### 10. Code Style and Codebase Consistency

**What to check:**

- Formatting matches linter/formatter config (consistent spacing, line length)
- Naming conventions (camelCase for vars/functions, PascalCase for classes/types)
- Import order (external, then internal, organized logically)
- File organization and module structure
- Consistent indentation and bracket placement
- Consistent use of constants vs. magic numbers/strings
- Consistent comment style and tone
- Consistent access modifiers (public, private, protected)
- Proper use of language features

**What to look for:**

- Inconsistent naming styles (mixing camelCase and snake_case)
- Imports not grouped or organized
- Magic numbers or strings not extracted to constants
- Inconsistent bracket placement or indentation
- Comments that use different tones or styles
- Inconsistent use of `const` vs. `let` vs. `var`
- Dead code or commented-out code left behind

### 11. Linting and Code Quality Checks

**What to check:**

- Code passes the linter (oxlint, ESLint, etc.) without errors
- Code passes the formatter (oxfmt, Prettier, etc.) without changes required
- Typecheck passes (`task check-types` or `tsc --noEmit`)
- All linter warnings are addressed or justified
- No new warnings introduced in changed files
- Build passes without errors or warnings

**What to look for:**

- Linter errors that would fail CI
- Linter warnings that could indicate real issues (unused variables, unreachable code, etc.)
- Formatting inconsistencies that violate linter rules
- Type errors that would cause build failures
- Configuration not matching repository standards

### 12. Testing Coverage and Verification

**What to check:**

- Unit tests pass (`task unit-tests` or equivalent)
- Integration tests pass (if applicable)
- E2E tests pass (if applicable)
- New code has appropriate test coverage
- Test failures are clear and actionable
- Tests cover edge cases and error paths
- Tests run reliably (no flaky tests)
- Test suite completes without timeout

**What to look for:**

- Missing tests for new functionality
- Tests that don't actually verify the code (always pass/fail)
- Tests that depend on each other or execution order
- Poor test coverage for critical code paths
- Skipped or pending tests that should be fixed
- Tests that verify implementation details instead of behavior

### 13. Library and API Documentation Verification

**What to check:**

- All external libraries used are from the expected versions
- API usage matches official library documentation
- No calls to deprecated or removed APIs
- Configuration matches library defaults/recommendations
- Library compatibility with project's Node/language version
- No hallucinated API methods or properties
- Dependency versions in package.json match actual usage

**What to look for:**

- API calls that don't exist in the library version
- Incorrect parameter order or types per library docs
- Missing or incorrect import paths
- Library method signatures that don't match code
- Deprecated APIs being used without justification
- Incorrect assumptions about library behavior

### Phase 1: Prepare

1. **Understand the change.**
   - Read the PR description, commit messages, and branch name.
   - Identify the scope: what files changed, what features/fixes are included.
   - Understand the intent: what problem does this solve, what behavior changed.

2. **Understand the context.**
   - Read the repository instructions (e.g., `copilot-instructions.md`).
   - Understand existing patterns for similar code in the repo.
   - Note any recent architectural decisions or standards.
   - Check for related existing code, tests, or documentation.

3. **Get the full diff.**
   - Examine ALL changed files, not just summaries.
   - Trace the change through dependent files and code paths.
   - Identify all affected modules and boundaries.

### Phase 2: Review Systematically

Review each dimension in order, tracing through the code thoroughly:

1. **Syntactical Correctness** — Does the code parse and resolve correctly? Are imports/exports correct? Are there obvious syntax errors?

2. **Programmatic Correctness** — Does the logic achieve its stated intent? Are edge cases handled? Is error handling complete?

3. **Data Flow Correctness** — Does data flow correctly through the system? Are transformations applied in order? Are there unexpected mutations?

4. **Type Correctness and Flow** — Are all types precise and correct? Are there any `any` types that should be fixed? Do types narrow correctly?

5. **Performance Issues** — Are there inefficient patterns or allocations? Are there N+1 queries or repeated work? Are algorithms appropriate?

6. **Security Vulnerabilities** — Is input validated and output encoded? Are secrets handled safely? Are there injection, CSRF, XSS, or auth risks?

7. **API Conformity** — Do APIs follow repository patterns? Are naming and shapes consistent? Is documentation accurate?

8. **Documentation Consistency** — Are all new APIs documented? Is behavior and usage documented? Are README and CHANGELOG updated?

9. **Best Practices** — Does code follow repository conventions? Are resources cleaned up? Is the code resilient?

10. **Code Style and Consistency** — Does it match formatter/linter expectations? Is naming consistent? Is it organized?

11. **Linting and Code Quality Checks** — Does code pass linter without errors? Are all linter warnings addressed? Does typecheck pass?

12. **Testing Coverage and Verification** — Do unit tests pass? Is new code covered by tests? Do tests verify behavior?

13. **Library and API Documentation Verification** — Consult official library documentation for all new external APIs. Verify signatures match. Ensure no hallucinated or deprecated APIs are used.

### Phase 3: Verify Library and API Documentation

For all external libraries and APIs used in the changes:

1. **Use available documentation tools:**
   - **Context7:** For up-to-date library documentation, correct syntax, and best practices. Use when checking library versions, API signatures, and configurations.
   - **DeepWiki:** For AI-powered documentation of GitHub repositories (if custom libraries are used).
   - **Web search (Exa):** For finding official documentation, examples, and confirmation of API behavior.

2. **Verify each API usage:**
   - Look up the exact method/function signature in the official docs
   - Confirm parameter types, order, and defaults
   - Check for deprecation warnings
   - Verify the function/property actually exists in the referenced version
   - Compare actual usage to documented examples

3. **Document findings:**
   - Note if an API signature matches documentation
   - Flag any discrepancies or hallucinated methods
   - Record the source documentation for verification
   - Note version-specific behavior

### Phase 4: Run Automated Checks

**CRITICAL:** The review must execute the repository's quality checks. If any check fails, the PR is **BLOCKED** for that check regardless of manual review findings.

1. **Typecheck:**
   - Run `task check-types` or `tsc --noEmit`
   - Must pass without errors
   - Any type errors block the PR

2. **Linting:**
   - Run `task lint` or the linter command
   - Must pass without errors
   - All linter warnings must be addressed (not hidden)
   - Treat warnings as defects if they indicate real issues

3. **Testing:**
   - Run `task unit-tests` or the test command
   - All tests must pass
   - Any test failures block the PR
   - Check for flaky or skipped tests

4. **Formatting:**
   - Run `task format --check` or formatter check
   - Code must match formatter output exactly
   - No formatting discrepancies allowed

5. **Document check results:**
   - Record pass/fail for each check
   - If any check fails, list all failures before proposing remediation
   - A single failed check is a CRITICAL finding

### Phase 5: Document Findings

For each issue found:

1. **Categorize** it (see 13 dimensions above)
2. **Rate severity:**
   - **CRITICAL:** Blocks merge; correctness, type safety, security, or failed automation checks
   - **HIGH:** Should be fixed before merge; significant risk or quality impact
   - **MEDIUM:** Should be fixed; minor risk or quality issue
   - **LOW:** Nice to fix; style, naming, or minor optimization

3. **Locate precisely:** file(s), line number(s) if available
4. **Explain why:** What is the problem, why does it matter, what is the risk?
5. **Describe affected code path:** What does this break or affect?
6. **Recommend a fix:** Specific, actionable remediation
7. **Provide verification:** How to test the fix

### Phase 6: Produce Remediation Plan

Organize all issues into a detailed remediation plan (see output format below).

### Phase 3: Document Findings

For each issue found:

1. **Categorize** it (see 10 dimensions above)
2. **Rate severity:**
   - **CRITICAL:** Blocks merge; security, correctness, or type safety issue
   - **HIGH:** Should be fixed before merge; significant risk or quality impact
   - **MEDIUM:** Should be fixed; minor risk or quality issue
   - **LOW:** Nice to fix; style, naming, or minor optimization
3. **Locate precisely:** file(s), line number(s) if available
4. **Explain why:** What is the problem, why does it matter, what is the risk?
5. **Describe affected code path:** What does this break or affect?
6. **Recommend a fix:** Specific, actionable remediation
7. **Provide verification:** How to test the fix

### Phase 4: Produce Remediation Plan

Organize all issues into a detailed remediation plan:

1. **Executive Summary**
   - Overall assessment of the changes
   - Major risks identified
   - Whether changes are safe to merge as-is

2. **Grouped Findings**
   - Group issues by category (one of the 10 dimensions)
   - Within each category, order by severity (CRITICAL → HIGH → MEDIUM → LOW)
   - For each finding: category, severity, file(s), line(s), description, why it matters, affected code path, recommended fix, verification method

3. **Ordered Remediation Plan**
   - Step-by-step fix order
   - Rationale for fix order (dependencies, risk levels)
   - Implementation guidance for each step
   - Tests to add or update
   - Documentation to update
   - Rollback considerations if applicable

4. **Verification Checklist**
   - Concrete checks: typecheck, lint, tests, security scans, API contracts, docs
   - Success criteria for each fix

5. **Final Recommendation**
   - **Approve as-is** (if no issues)
   - **Approve after fixes** (if issues are fixable and low-risk)
   - **Block until fixed** (if CRITICAL issues present)

## Output format (required)

When producing a remediation plan, use this exact structure:

```markdown
## Executive Summary

[Overall assessment, major risks, merge recommendation]

## Findings

### [Category Name]

#### [Issue Title]

- **Severity:** CRITICAL | HIGH | MEDIUM | LOW
- **File(s):** [file:line range]
- **Description:** [What is the issue?]
- **Why it matters:** [Why is this a problem?]
- **Affected code path:** [What does this break/affect?]
- **Root cause:** [Why did this happen?]
- **Recommended fix:** [Specific remediation]
- **Verification:** [How to test the fix]

[Repeat for each issue, grouped by category, ordered by severity]

## Remediation Plan

### Step 1: [Issue(s) to fix]

- **Rationale:** [Why fix this first?]
- **Implementation:** [How to implement]
- **Tests:** [What tests to add/update]
- **Docs:** [What documentation to update]
- **Rollback:** [Any rollback considerations]

[Repeat for each step, in dependency order]

## Verification Checklist

- [ ] `task check-types` passes
- [ ] `task lint` passes
- [ ] `task unit-tests` passes
- [ ] Security scans pass (if applicable)
- [ ] API contracts verified (if applicable)
- [ ] Documentation review complete
- [ ] No `any` types (or justified)

## Final Recommendation

**[APPROVE AS-IS | APPROVE AFTER FIXES | BLOCK UNTIL FIXED]**

[Brief justification]
```

## Important rules (non-negotiable)

1. **Always produce a plan before proposing fixes.** Document all issues first; get approval to proceed before implementing.
2. **Be thorough and conservative.** If something might be wrong, flag it. Do not minimize issues or give benefit of doubt.
3. **Trace all code paths.** Do not review just changed lines; understand the impact on surrounding code and modules.
4. **Zero `any` tolerance.** Treat `any` as a defect unless there is explicit, strong, documented justification.
5. **Reference the repository.** Use repo conventions, existing patterns, and instructions as the source of truth.
6. **Distinguish risk levels.** Mark which fixes are safe (low-risk) and which are higher-risk.
7. **Note dependencies.** Identify which fixes depend on others and must be done in a specific order.
8. **Verify completeness.** If you cannot fully verify a section, say so explicitly and explain what is missing.
9. **Wait for approval.** Do not begin implementing fixes until explicitly instructed to do so.

## Example trigger phrases

- "Review the PR changes"
- "Conduct a code review for merge"
- "Check this diff for correctness"
- "Exhaustive code review"
- "Find all issues in these changes"
- "Generate a remediation plan"

## Related skills

- **commit-helper:** Format commits properly after fixes are applied
- **code-reviewer:** General code review for style and best practices
- **security-review:** Deep security-focused analysis
- **testing:** Ensure test coverage for fixes
