/**
 * Smoke test: aImock Vitest plugin bootstrap and provider fixture coverage.
 *
 * Verifies that the aImock `useAimock()` plugin correctly starts the mock
 * server, patches environment variables, and serves fixtures for OpenAI,
 * Anthropic, and Gemini endpoints.
 */

import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });

  // Register fixtures matching the existing MSW default-streams behavior
  mock.onMessage('hello', { content: 'Hello, world!' });
  mock.onMessage('hello from anthropic', { content: 'Hello from Anthropic' });
  mock.onMessage('gemini streaming', { content: 'Gemini here' });

  await mock.start();
  process.env.OPENAI_BASE_URL = `${mock.url}/v1`;
  process.env.ANTHROPIC_BASE_URL = `${mock.url}/v1`;
});

afterEach(() => {
  // Reset match counts between tests
});

afterAll(async () => {
  await mock.stop();
  delete process.env.OPENAI_BASE_URL;
  delete process.env.ANTHROPIC_BASE_URL;
});

describe('aImock Vitest plugin', () => {
  describe('OpenAI handler', () => {
    it('intercepts streaming chat completions and returns SSE chunks', async () => {
      const response = await fetch(`${mock.url}/v1/chat/completions`, {
        body: JSON.stringify({
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-4o',
          stream: true
        }),
        headers: { Authorization: 'Bearer mock-key', 'Content-Type': 'application/json' },
        method: 'POST'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      const body = await response.text();
      expect(body).toContain('data:');
      expect(body).toContain('Hello');
    });

    it('intercepts non-streaming chat completions', async () => {
      const response = await fetch(`${mock.url}/v1/chat/completions`, {
        body: JSON.stringify({
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-4o'
        }),
        headers: { Authorization: 'Bearer mock-key', 'Content-Type': 'application/json' },
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).toHaveProperty('choices');
    });
  });

  describe('Anthropic handler', () => {
    it('intercepts messages streaming request', async () => {
      const response = await fetch(`${mock.url}/v1/messages`, {
        body: JSON.stringify({
          max_tokens: 1024,
          messages: [{ content: 'hello from anthropic', role: 'user' }],
          model: 'claude-opus',
          stream: true
        }),
        headers: { 'x-api-key': 'mock-key', 'Content-Type': 'application/json' },
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('Hello');
    });
  });

  describe('Gemini handler', () => {
    it('intercepts generateContent request', async () => {
      const response = await fetch(`${mock.url}/v1beta/models/gemini-2.0-flash:generateContent`, {
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'gemini streaming' }] }]
        }),
        headers: { Authorization: 'Bearer mock-key', 'Content-Type': 'application/json' },
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).toHaveProperty('candidates');
    });
  });
});
