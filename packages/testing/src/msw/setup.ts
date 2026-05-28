/**
 * Vitest global setup for MSW integration tests in @agentsy/testing.
 *
 * Creates and manages the lifecycle of an MSW test server across all tests.
 *
 * Usage in test files:
 * ```typescript
 * import { createTestServer } from '@agentsy/testing/msw';
 *
 * const ts = createTestServer();
 *
 * beforeAll(() => ts.server.listen({ onUnhandledRequest: 'warn' }));
 * afterEach(() => ts.server.resetHandlers());
 * afterAll(() => ts.server.close());
 * ```
 *
 * @module @agentsy/testing/msw/setup
 */

export type { TestServer, TestServerConfig } from './index.js';
export { createTestServer } from './index.js';
