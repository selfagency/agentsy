# Developer guide

This guide summarizes local development for the `@agentsy` monorepo.

> For the primary, maintained developer docs, see [`docs/developers/index.md`](./developers/index.md).

## Prerequisites

- Node.js 22+
- pnpm (workspace package manager)

## Common commands

Run from repository root:

```bash
pnpm install
pnpm build
pnpm check-types
pnpm test
pnpm lint
pnpm format
```

## Package-level work

```bash
cd packages/<package-name>
pnpm build
pnpm test
pnpm check-types
```

## Related docs

- [Developer docs index](./developers/index.md)
- [Contributing](./developers/contributing.md)
- [Releasing](./developers/releasing.md)
- [Architecture overview](./architecture/index.md)
- [Package catalog](./packages.md)
