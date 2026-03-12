# Developer Guide

This document covers local development, testing, and release operations for `llm-stream-parser`.

## Prerequisites

- Node.js 20+ (18+ minimum, but 20+ recommended for tooling compatibility)
- pnpm (version pinned in `package.json`)
- `task` CLI (optional, recommended)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

`pnpm install` is the only required direct package-manager command for normal development.

### 2. Build and verify

```bash
task compile
task check-types
task unit-tests
task lint
task check-formatting
```

Or run all checks at once:

```bash
task check-all
```

## Development Workflow

### Running tasks

We use Taskfile.yaml for consistent workflows:

```bash
task <task-name>
```

View all available tasks:

```bash
task --list
```

### Common tasks

| Task                 | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `check-types`        | Run TypeScript type checker               |
| `lint`               | Run linter (oxlint)                       |
| `lint-fix`           | Auto-fix linting issues                   |
| `check-formatting`   | Check code formatting                     |
| `formatting`         | Auto-format code                          |
| `compile`            | Build distribution (tsup)                 |
| `unit-tests`         | Run all tests                             |
| `unit-test-coverage` | Run tests with coverage report            |
| `precommit`          | Run pre-commit checks (lint-fix + format) |
| `watch`              | Watch for changes and recompile           |

### Development mode

Watch for changes and automatically rebuild:

```bash
task watch
```

This runs tsup in watch mode.

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
task unit-tests

# Run tests with coverage
task unit-test-coverage

# Run specific test file
task unit-tests src/thinking/thinking.test.ts

# Watch mode
pnpm vitest src
```

## Building and Releases

### Build outputs

The package uses `tsup` for building:

```bash
task compile
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
   task release -- <version>
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
task release -- 0.2.0        # Stable release
task release -- 0.2.0-alpha.1 # Prerelease
```

## CI/CD

See `.github/workflows/`:

- **Test & Build** - Runs tests and builds on all branches
- **Release** - Publishes to npm after merge to main

## Code Quality

### Check all code quality rules

```bash
task check-all
```

This runs:

1. Type checking (TypeScript)
2. Linting (oxlint)
3. Formatting checks (oxfmt)

### Auto-fix issues

```bash
task precommit
```

This runs:

1. Lint with auto-fix
2. Format code

### Git hooks

Pre-commit hooks are configured via husky:

```bash
# Install git hooks
pnpm husky install
```

## Debugging

### TypeScript errors

```bash
task check-types

# Or directly:
pnpm tsc --noEmit
```

### Linting errors

```bash
task lint-fix
```

### Test failures

```bash
pnpm vitest src <path-to-test>
```

Debug specific tests:

```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run src/path/to/test.ts
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

## Project Structure

```text
llm-stream-parser/
├── src/
│   ├── thinking/         # Thinking tag extraction
│   ├── xml-filter/       # XML context filtering
│   ├── tool-calls/       # Tool call extraction
│   ├── context/          # Context block processing
│   ├── structured/       # JSON parsing & schema validation
│   ├── formatting/       # Output formatting
│   ├── processor/        # Stream processor orchestration
│   ├── markdown/         # Markdown parsing
│   ├── adapters/         # Pre-built adapters
│   └── index.ts          # Main entry point
├── dist/                 # Compiled output (tsup)
├── docs/                 # Documentation (VitePress)
├── .vitepress/          # VitePress config
├── scripts/             # Build and release scripts
├── Taskfile.yaml        # Task definitions
├── tsconfig.json        # TypeScript config
├── tsup.config.ts       # Build config
└── package.json         # Package metadata
```

## Contributing Guidelines

1. Create a feature branch from `main`
2. Make changes and add tests
3. Run `task check-all` and `task unit-tests` locally
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
task check-types --force
```

### Tests pass locally but fail in CI

- Check Node.js version in CI matches local
- Check environment variables
- Run `task check-all` locally

### Build artifacts missing

```bash
rm -rf dist pnpm-lock.yaml
pnpm install
task compile
```

## Additional Resources

- [API Reference](/api) - Complete API documentation
- [Getting Started](/getting-started) - Usage examples
- [Integration Guide](/developers/integration-copilot) - Integration patterns
