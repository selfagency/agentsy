# @agentsy/integration

Cross-package integration test suite for the Agentsy monorepo.

## Purpose

`@agentsy/integration` validates behavior across package boundaries (normalizers → processor → renderers → recovery, etc.).

## Role in Agentsy

This package is the monorepo-level confidence layer. It is not intended as a runtime dependency for consumers.

## Status

- Private/internal package.
- Not published for external consumption.

## Notes

This is the one current package in the repo that is intentionally not part of the public published package family.

## Usage

Run integration tests from this package or from repo root.

```bash
cd packages/integration
pnpm test
pnpm coverage
```

From root:

```bash
pnpm test
pnpm test:coverage
```
