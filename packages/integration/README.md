# @agentsy/integration

Cross-package integration test suite for the Agentsy monorepo.

## Purpose

`@agentsy/integration` validates behavior across package boundaries (normalizers → processor → renderers → recovery, etc.).

## Role in Agentsy

This package is the monorepo-level confidence layer. It is not intended as a runtime dependency for consumers.

## Status

- Private/internal package.
- Not published for external consumption.

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
