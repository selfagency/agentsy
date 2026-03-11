# Contributing

We welcome contributions to `llm-stream-parser`! This guide explains how to contribute.

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
task check-all

# Auto-fix issues
task precommit
```

Tools used:
- **Linting**: oxlint (and oxlint-tsgolint for TypeScript)
- **Formatting**: oxfmt
- **Type checking**: TypeScript

### Testing

All changes must include tests:

```bash
# Run tests
task unit-tests

# Run with coverage
task unit-test-coverage
```

Test structure:
- Colocate tests with source files (`.test.ts`)
- Test streaming behavior with partial chunks
- Verify safety rails (limits, scrubbing)
- Test error cases and edge cases

## Submitting Changes

### Pull Request Process

1. **Before opening**: Ensure local checks pass
   ```bash
   task check-all
   task unit-tests
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

```
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
