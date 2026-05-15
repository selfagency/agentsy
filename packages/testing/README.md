# @agentsy/testing

Cross-package integration test suite for the Agentsy monorepo.

## Purpose

`@agentsy/testing` validates behavior across package boundaries (normalizers → processor → renderers → recovery, etc.).

## Role in Agentsy

This package is the monorepo-level confidence layer. It is not intended as a runtime dependency for consumers.

## Status

- Private/internal package.
- Not published for external consumption.

## Notes

This is the one current package in the repo that is intentionally not part of the public published package family.

## Usage

Run integration tests from this package or from repo root.

### Network mocking

Use MSW (`msw` v2) for HTTP/network-bound tests. Prefer shared handlers and lifecycle setup in `@agentsy/testing` over ad hoc request stubs or per-test monkeypatches.

```bash
cd packages/testing
pnpm test
pnpm coverage
```

From root:

```bash
pnpm test
pnpm test:coverage
```
