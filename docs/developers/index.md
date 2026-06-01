# Developer Guide

This document covers local development, testing, and release operations for the `@agentsy` monorepo.

## Prerequisites

- Node.js 22+
- pnpm (version pinned in `package.json`)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

`pnpm install` is the only required direct package-manager command for normal development.

### 2. Build and verify

```bash
pnpm build
pnpm check-types
pnpm test
pnpm lint
pnpm format
```

Or run all checks at once:

```bash
pnpm check-types && pnpm test && pnpm lint
```

## Development Workflow

### Running tasks

We use root `pnpm` scripts orchestrated by Turborepo:

```bash
pnpm build
pnpm check-types
pnpm lint
pnpm lint:fix
pnpm format
pnpm test
pnpm test:coverage
pnpm precommit
```

### Common scripts

| Script               | Purpose                             |
| -------------------- | ----------------------------------- |
| `pnpm check-types`   | Run TypeScript type checker         |
| `pnpm lint`          | Run linter (oxlint)                 |
| `pnpm lint:fix`      | Auto-fix linting issues             |
| `pnpm format`        | Auto-format code (oxfmt)            |
| `pnpm build`         | Build distribution (tsup via turbo) |
| `pnpm test`          | Run all tests                       |
| `pnpm test:coverage` | Run tests with coverage report      |
| `pnpm precommit`     | Run pre-commit checks               |

### Development mode

Watch for changes and automatically rebuild:

```bash
pnpm --filter @agentsy/vscode test -- --watch
```

For package-specific watch workflows, run the package-local scripts inside that package directory.

## Testing Strategy

### Structure

Tests are colocated with source modules in `src/**/*.test.ts`:

```text
src/
├── thinking/
│   ├── index.ts
│   └── thinking.test.ts
├── xml-filter/
│   ├── index.ts
│   └── xml-filter.test.ts
└── ...
```

### Best practices

- Keep parser behavior deterministic across chunk boundaries
- Test streaming edge cases (partial chunks, large inputs)
- Assert safety rails explicitly:
  - Privacy scrub defaults
  - Tool-call count/size limits
  - JSON depth/key limits
- Add targeted unit tests for bug fixes

### Run tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm --filter @agentsy/core test -- src/thinking/ThinkingParser.test.ts

# Watch mode
pnpm vitest src
```

## Building and Releases

### Build outputs

The package uses `tsup` for building:

```bash
pnpm build
```

This generates:

- `dist/` - Compiled JavaScript and TypeScript declarations
- `dist/package.json` - Package metadata (auto-generated)

### Distribution files

- `dist/index.js` - ES modules (primary)
- `dist/index.cjs` - CommonJS (for Node.js `require`)
- `dist/index.d.ts` - TypeScript declarations

Each subpath export also gets compiled:

- `dist/thinking/index.js`, `.cjs`, `.d.ts`
- `dist/structured/index.js`, `.cjs`, `.d.ts`
- etc.

### Release process

The package uses scripted release automation:

1. Create feature branch and make changes
2. Commit and push changes
3. Create pull request on GitHub
4. After merge to main:

   ```bash
   pnpm release
   ```

The release script:

- Builds with `pnpm run build`
- Publishes `./dist` to npm registry
- Tags commit on GitHub

### Version scheme

- Stable versions → published to `latest` tag on npm
- Prerelease versions → published to `next` tag

Example:

```bash
pnpm release # per-package scripted release helper
```

## CI/CD

See `.github/workflows/`:

- **Test & Build** - Runs tests and builds on all branches
- **Release** - Publishes to npm after merge to main

## Code Quality

### Check all code quality rules

```bash
pnpm check-types && pnpm lint && pnpm format
```

This runs:

1. Type checking (TypeScript)
2. Linting (oxlint)
3. Formatting checks (oxfmt)

### Auto-fix issues

```bash
pnpm lint:fix && pnpm format
```

This runs:

1. Lint with auto-fix
2. Format code

### Git hooks

Pre-commit hooks are configured via husky:

```bash
# Install git hooks
pnpm install
```

## Debugging

### TypeScript errors

```bash
pnpm check-types

# Or directly:
pnpm tsc --noEmit
```

### Linting errors

```bash
pnpm lint:fix
```

### Test failures

```bash
pnpm vitest src <path-to-test>
```

Debug specific tests:

```bash
node --inspect-brk ./node_modules/vitest/vitest.js run src/path/to/test.ts
```

## Documentation

Documentation is built with VitePress:

```bash
pnpm docs:dev    # Start dev server
pnpm docs:build  # Build static site
pnpm docs:preview # Preview built site
```

Documentation sources:

- `docs/` - Markdown documentation
- `.vitepress/config.ts` - VitePress configuration

### Documentation maintenance rules

When you change the public-facing behavior of a package, update these surfaces together:

1. the package source exports in `packages/<name>/src/index.ts`
2. the package-local `README.md`
3. the corresponding page in `docs/packages/`
4. the cross-package index in `docs/api.md` when exported symbols changed

If the change also affects ecosystem positioning, update one or more of:

- `docs/index.md`
- `docs/packages.md`
- `docs/architecture/*.md`
- `docs/roadmap.md`

Future-facing changes should be grounded in the relevant file under `plan/` rather than described as already implemented.

## Documentation map

- [Documentation home](../index.md)
- [Package inventory](../packages.md)
- [Roadmap (planned)](../roadmap.md)
- [Integration guide](./integration-copilot.md)
- [Releasing](./releasing.md)

## Project Structure

```text
agentsy/
├── packages/
│   ├── core/              # Consolidated stream processing + utilities
│   ├── providers/         # Provider adapters, normalizers, pipeline
│   ├── runtime/           # Runtime loops + AG-UI subpath
│   ├── orchestrator/      # Agent loop + scheduler orchestration
│   ├── tokens/            # Token budgets and pacing
│   ├── renderers/         # CLI/TUI/plain renderers
│   ├── ui/                # Conversation-state projection
│   ├── vscode/            # VS Code integration package
│   └── ...other internal packages
├── docs/
├── .vitepress/
├── scripts/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Contributing Guidelines

1. Create a feature branch from `main`
2. Make changes and add tests
3. Run `pnpm check-types`, `pnpm lint`, and `pnpm test` locally
4. Commit with clear messages
5. Push and create pull request
6. Address review feedback
7. After merge, maintainer runs release workflow

## Troubleshooting

### pnpm install fails

- Clear pnpm cache: `pnpm store prune`
- Delete pnpm-lock.yaml and reinstall
- Ensure Node.js version matches

### Type errors after changes

```bash
pnpm check-types
```

### Tests pass locally but fail in CI

- Check Node.js version in CI matches local
- Check environment variables
- Run `pnpm check-types && pnpm lint && pnpm test` locally

### Build artifacts missing

```bash
rm -rf dist pnpm-lock.yaml
pnpm install
pnpm build
```

## Additional Resources

- [API Reference](/api) - Complete API documentation
- [Getting Started](/getting-started) - Usage examples
- [Integration Guide](/developers/integration-copilot) - Integration patterns
