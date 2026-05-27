# Contributing

We welcome contributions to the `@agentsy` monorepo! This guide explains how to contribute.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Follow the [Developer Guide](/) for setup

## Development Process

### Creating a feature branch

```bash
git checkout -b feat/your-feature-name
```

Branch naming conventions:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `test/` - Test additions
- `refactor/` - Code refactoring

### Making changes

1. Create focused, atomic commits
2. Write clear commit messages
3. Add tests alongside code changes
4. Update documentation if needed

### Code style

Our code style is enforced by tools:

```bash
# Check formatting and linting
pnpm check-types && pnpm lint && pnpm format

# Auto-fix issues
pnpm lint:fix && pnpm format
```

Tools used:

- **Linting/Formatting**: Biome (via ultracite preset)
- **Type checking**: TypeScript

### Testing

All changes must include tests:

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run CLI E2E terminal tests (if CLI package changed)
pnpm --filter @agentsy/cli test:e2e
```

Test structure:

- Colocate unit tests with source files (`.test.ts`)
- Test streaming behavior with partial chunks
- Verify safety rails (limits, scrubbing)
- Test error cases and edge cases

### CLI E2E tests

The `@agentsy/cli` package uses [`@microsoft/tui-test`](https://github.com/microsoft/tui-test) for real-PTY E2E tests. These tests run the CLI as a real subprocess, validating terminal output and interactive behavior.

**When adding a new CLI command**, you must also add a tui-test spec:

1. Create `packages/cli/src/e2e/<command>.spec.ts`
2. Import `{ test, expect }` from `@microsoft/tui-test`
3. Write tests using `terminal.submit()`, `terminal.write()`, and `expect().toBeVisible()`
4. Run `pnpm --filter @agentsy/cli test:e2e` to verify
5. Update the spec table in `packages/cli/README.md`

**Existing E2E specs** in `packages/cli/src/e2e/`:

| Spec | Covers |
|---|---|
| `compress.spec.ts` | `compress --text`, `--file`, invalid level, missing input |
| `compress-memory.spec.ts` | `compress-memory --file`, `--no-backup`, missing flag |
| `memory-sync-dev.spec.ts` | `memory-sync-dev`, `--json`, custom flags, invalid args |
| `chat.spec.ts` | `/exit`, message send, `/help` |
| `cli-basics.spec.ts` | Unknown command, default entry |

## Submitting Changes

### Pull Request Process

1. **Before opening**: Ensure local checks pass

   ```bash
   pnpm check-types
   pnpm lint
   pnpm test
   ```

2. **Create PR** with:
   - Clear title describing the change
   - Description of what and why
   - Link any related issues
   - Screenshots/examples if applicable

3. **Address feedback**: Update PR based on review comments

4. **Merge**: Maintainers will merge after approval

### PR Title Format

Follow conventional commits:

- `feat: add support for custom tag names`
- `fix: resolve JSON parsing with deep nesting`
- `docs: update API reference examples`
- `test: add coverage for streaming edge cases`

## Types of Contributions

### Bug Reports

File issues with:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS)
- Minimal code example

### Feature Requests

Describe:

- Use case and motivation
- Expected behavior
- Potential implementation approach
- Any concerns or trade-offs

### Documentation

Improvements to:

- README.md
- docs/ guides
- API reference
- Code comments
- Examples

### Parser Improvements

- Better error messages
- Performance optimizations
- New parser utilities
- Adapter improvements

## Testing Guidelines

### What to test

- Normal operation with various inputs
- Edge cases (empty strings, deeply nested structures)
- Error cases (malformed input, limits exceeded)
- Streaming behavior (partial chunks, boundaries)
- Integration between parsers

### Example test structure

```typescript
import { describe, it, expect } from 'vitest';
import { parseJson } from '../index';

describe('parseJson', () => {
  it('should parse valid JSON', () => {
    const result = parseJson('{"key": "value"}');
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('should handle malformed JSON', () => {
    const result = parseJson('{invalid}');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should enforce max depth limit', () => {
    const deep = '{"a":' + '{"b":'.repeat(10) + '1' + '}'.repeat(11);
    const result = parseJson(deep, { maxDepth: 5 });
    expect(result.valid).toBe(false);
  });
});
```

## Commit Messages

Write clear, descriptive commits:

```text
Short summary (50 chars max)

Longer explanation of the change if needed.
Explain the why, not just the what.

Fixes #123
Related to #456
```

## Questions?

- Check the [Developer Guide](/)
- Review existing issues and PRs
- Open a discussion on GitHub
- Ask in the PR review

Thank you for contributing!
