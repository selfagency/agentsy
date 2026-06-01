# @agentsy/testing

Cross-package integration test suite for the Agentsy monorepo.

## Purpose

`@agentsy/testing` validates behavior across package boundaries (normalizers → processor → renderers → recovery, etc.).

## Role in Agentsy

This package is the monorepo-level confidence layer. It is not intended as a runtime dependency for consumers.

## Status

- Private/internal package.
- Not published for external consumption.

## Mocking Strategy

This package uses a dual mocking approach:

### aImock (LLM Providers)

For LLM API mocking (OpenAI, Anthropic, Gemini), use
[`@copilotkit/aimock`](https://github.com/CopilotKit/aimock):

```typescript
import { LLMock } from '@copilotkit/aimock';

const mock = new LLMock({ port: 0 });
mock.onMessage('hello', { content: 'Hi there!' });
await mock.start();

process.env.OPENAI_BASE_URL = `${mock.url}/v1`;
// ... run tests ...
await mock.stop();
```

Fixtures live in `fixtures/aimock/`. See `src/aimock.test.ts` for examples.

### MSW (Memory, Retrieval, Custom HTTP)

For non-LLM HTTP endpoints (memory API, retrieval/embedding API, custom
endpoints), use the MSW test server:

```typescript
import { createTestServer } from '@agentsy/testing/msw';

const ts = createTestServer({ includeProviders: false });

beforeAll(() => ts.server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => ts.server.resetHandlers());
afterAll(() => ts.server.close());
```

> **Note:** MSW provider handlers (`createOpenAIHandler`, etc.) are deprecated.
> Use aImock for LLM provider mocking. See `plan/19-AIMOCK-MIGRATION-PLAN.md`.

## Usage

Run integration tests from this package or from repo root.

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
