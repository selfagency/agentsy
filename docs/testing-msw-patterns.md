# MSW Test Patterns

> Patterns and conventions for using MSW (Mock Service Worker) v2 in
> `@agentsy/testing` integration tests.
>
> See also: `API-POSTURE-MATRIX.md` for overall entry point coverage.

---

## Architecture

```text
packages/testing/src/msw/
├── index.ts            ← createTestServer() factory
├── setup.ts            ← Re-exports for Vitest lifecycle integration
└── handlers/
    ├── index.ts        ← Barrel re-exports
    ├── providers.ts     ← OpenAI / Anthropic / Gemini SSE handlers
    ├── memory.ts        ← Memory/RAG CRUD + search handlers
    └── retrieval.ts     ← Embedding + re-rank handlers
```

Each handler module exposes:

1. **State type** — mutable state object for controlling test scenarios
2. **Factory** — `createMock*State()` returning initial state
3. **Handler factory** — `create*Handlers(options?)` returning `HttpHandler[]`
4. **Individual handler factories** — per-endpoint for targeted overrides

---

## Setup Pattern (Standard)

```typescript
// tests/my-test.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestServer } from '@agentsy/testing/msw';

const ts = createTestServer();

beforeAll(() => ts.server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => ts.server.resetHandlers());
afterAll(() => ts.server.close());
```

**Why this works:**

- `beforeAll` starts the server with all built-in handlers
- `afterEach` resets to defaults between tests (prevents state leakage)
- `onUnhandledRequest: 'error'` catches un-mocked API calls

---

## State-Driven Testing

Each handler set has a shared mutable state object that you mutate per test:

### Memory State

```typescript
it('returns 503 when health is down', async () => {
  ts.memoryState.healthy = false;
  const response = await fetch('http://localhost:3080/health');
  expect(response.status).toBe(503);
  // No need to reset manually — afterEach handles it
});
```

### Retrieval State

```typescript
it('generates embeddings', async () => {
  const response = await fetch('http://localhost:3081/embed', {
    body: JSON.stringify({ texts: ['hello'] }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
  const data = await response.json();
  expect(data.embeddings[0].embedding).toHaveLength(1536);
});
```

---

## Provider Streaming Tests

Provider handlers simulate SSE streaming responses from OpenAI, Anthropic, and Gemini:

```typescript
it('intercepts OpenAI streaming', async () => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    body: JSON.stringify({ model: 'gpt-4o', messages: [...], stream: true }),
    headers: { Authorization: 'Bearer mock-key', 'Content-Type': 'application/json' },
    method: 'POST'
  });

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/event-stream');

  const body = await response.text();
  expect(body).toContain('data:');
  expect(body).toContain('[DONE]');
});
```

### Error Simulation

```typescript
import { http } from 'msw';

it('handles 429 rate limit from provider', async () => {
  // Override a specific handler for one test
  ts.server.use(
    http.post('https://api.openai.com/v1/chat/completions', () =>
      new HttpResponse(null, { status: 429, statusText: 'Too Many Requests' })
    )
  );

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    body: JSON.stringify({ model: 'gpt-4o', messages: [...] }),
    headers: { Authorization: 'Bearer mock-key', 'Content-Type': 'application/json' },
    method: 'POST'
  });

  expect(response.status).toBe(429);
});
```

---

## Selective Handler Loading

Use `TestServerConfig` to load only the handlers you need:

```typescript
// Only provider handlers, no memory or retrieval
const ts = createTestServer({
  includeMemory: false,
  includeRetrieval: false
});
```

```typescript
// Custom base URLs and pre-populated state
const ts = createTestServer({
  memoryBaseUrl: 'http://localhost:3999',
  memoryState: { documents: new Map(), healthy: true, searchResults: [...] }
});
```

---

## Custom Handlers

Add extra handlers via `extraHandlers`:

```typescript
const ts = createTestServer({
  extraHandlers: [
    http.get('https://api.example.com/custom', () =>
      HttpResponse.json({ data: 'mock' })
    )
  ]
});
```

Or at test time using `ts.server.use()`:

```typescript
it('with runtime override', async () => {
  ts.server.use(
    http.get('http://localhost:3080/health', () =>
      HttpResponse.json({ status: 'degraded' }, { status: 200 })
    )
  );
  // ...
});
```

---

## Fixture Payloads

Reusable test payloads live in `packages/testing/fixtures/`:

| Path | Contents |
|---|---|
| `fixtures/retrieval/corpus.json` | Sample RAG corpus documents |

Use fixture files in tests by importing or reading from the fixtures path:

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const corpus = JSON.parse(
  readFileSync(resolve(__dirname, '../../fixtures/retrieval/corpus.json'), 'utf-8')
);
```

---

## Best Practices

1. **Always call `server.resetHandlers()` in `afterEach`** — prevents cross-test leaks
2. **Prefer state-driven overrides** — mutate state objects instead of swapping handlers
3. **Use `ts.server.use()` for one-off handler overrides** — temporary, scoped to that test
4. **Set `onUnhandledRequest: 'error'`** — catches unmocked requests during test runs
5. **Keep fixture data synthetic** — no real secrets, no production PII
6. **Prefer MSW over `vi.fn()` fetch stubs** — closer to real HTTP semantics
7. **Isolate URL changes via `baseUrl` config options** — don't hardcode ports
