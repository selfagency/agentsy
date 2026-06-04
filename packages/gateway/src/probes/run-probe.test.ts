import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { UsageProbe } from '@agentsy/providers/profiles';
import { describe, expect, it, vi } from 'vitest';

import { defaultApiParse, runProbe } from './run-probe.js';

function makeFetch(body: string, headers: Record<string, string> = {}): typeof globalThis.fetch {
  return (async () =>
    new Response(body, {
      headers: new Headers(headers),
      status: 200
    })) as unknown as typeof globalThis.fetch;
}

describe('defaultApiParse', () => {
  it('reads OpenAI rate-limit headers', () => {
    const result = defaultApiParse({
      body: '{}',
      headers: {
        'x-ratelimit-limit-requests': '5000',
        'x-ratelimit-remaining-requests': '4500',
        'x-ratelimit-limit-tokens': '125000',
        'x-ratelimit-remaining-tokens': '100000'
      }
    });
    expect(result).toEqual({
      rpmLimit: 5000,
      rpmRemaining: 4500,
      tpmLimit: 125_000,
      tpmRemaining: 100_000
    });
  });

  it('falls back to JSON usage fields', () => {
    const result = defaultApiParse({
      body: JSON.stringify({ usage: { rpm_limit: 60, rpm_remaining: 30, tpm_limit: 1000, tpm_remaining: 800 } }),
      headers: {}
    });
    expect(result).toEqual({
      creditsRemaining: undefined,
      rpmLimit: 60,
      rpmRemaining: 30,
      tpmLimit: 1000,
      tpmRemaining: 800
    });
  });

  it('returns null for empty input', () => {
    expect(defaultApiParse({ body: '', headers: {} })).toBeNull();
  });
});

describe('runProbe (api)', () => {
  const apiProbe: UsageProbe = { kind: 'api', path: '/v1/me/rate_limit' };

  it('returns null when baseUrl is missing', async () => {
    const result = await runProbe(apiProbe, { fetch: makeFetch('{}') });
    expect(result).toBeNull();
  });

  it('fetches and parses the response', async () => {
    const fetchImpl = vi.fn((url: string) => {
      expect(url).toBe('https://api.deepinfra.com/v1/me/rate_limit');
      return Promise.resolve(
        new Response(JSON.stringify({ rate_limit: { rpm_limit: 100, rpm_remaining: 80 } }), {
          headers: new Headers({ 'content-type': 'application/json' }),
          status: 200
        })
      );
    });
    const result = await runProbe(apiProbe, {
      baseUrl: 'https://api.deepinfra.com',
      fetch: fetchImpl as unknown as typeof globalThis.fetch
    });
    expect(result?.rpmLimit).toBe(100);
    expect(result?.rpmRemaining).toBe(80);
  });

  it('uses the authPrefix header when provided', async () => {
    const seen: Record<string, string> = {};
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => new Response('{}', { status: 200 })
    );
    await runProbe(
      { authPrefix: 'x-api-key', kind: 'api', path: '/usage' },
      {
        apiKey: 'sk-test',
        baseUrl: 'https://api.anthropic.com',
        fetch: ((input: string | URL | Request, init?: RequestInit) => {
          const headers = (init?.headers ?? {}) as Record<string, string>;
          Object.assign(seen, headers);
          return fetchImpl(input, init);
        }) as unknown as typeof globalThis.fetch
      }
    );
    expect(seen['x-api-key']).toBe('sk-test');
  });

  it('uses Authorization: Bearer when authPrefix is absent', async () => {
    const seen: Record<string, string> = {};
    await runProbe(apiProbe, {
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com',
      fetch: ((_input: string | URL | Request, init?: RequestInit) => {
        Object.assign(seen, (init?.headers ?? {}) as Record<string, string>);
        return Promise.resolve(new Response('{}', { status: 200 }));
      }) as unknown as typeof globalThis.fetch
    });
    expect(seen.Authorization).toBe('Bearer sk-test');
  });

  it('returns null when fetch throws', async () => {
    const fetchImpl = (() => Promise.reject(new Error('network down'))) as unknown as typeof globalThis.fetch;
    const result = await runProbe(apiProbe, {
      baseUrl: 'https://api.openai.com',
      fetch: fetchImpl
    });
    expect(result).toBeNull();
  });

  it('returns null on non-2xx', async () => {
    const fetchImpl = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof globalThis.fetch;
    const result = await runProbe(apiProbe, {
      baseUrl: 'https://api.openai.com',
      fetch: fetchImpl
    });
    expect(result).toBeNull();
  });

  it('honors a custom parse callback', async () => {
    const probe: UsageProbe = {
      kind: 'api',
      parse: () => ({ creditsRemaining: 42 }),
      path: '/me'
    };
    const result = await runProbe(probe, {
      baseUrl: 'https://api.example.com',
      fetch: makeFetch('irrelevant')
    });
    expect(result).toEqual({ creditsRemaining: 42 });
  });
});

describe('runProbe (local)', () => {
  it('reads from the local file path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'probe-'));
    const file = join(dir, 'cache.json');
    try {
      await writeFile(file, JSON.stringify({ rpm_limit: 10, rpm_remaining: 5 }), 'utf8');
      const result = await runProbe({ kind: 'local', path: file }, { localPath: file });
      expect(result?.rpmLimit).toBe(10);
      expect(result?.rpmRemaining).toBe(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns null when the file is missing', async () => {
    const result = await runProbe({ kind: 'local', path: '/no/such/file' }, {});
    expect(result).toBeNull();
  });
});

describe('runProbe (cli)', () => {
  it('returns null when command is missing', async () => {
    const result = await runProbe({ kind: 'cli', path: '/usage' }, {});
    expect(result).toBeNull();
  });

  it('runs the command and parses stdout', async () => {
    const result = await runProbe(
      {
        kind: 'cli',
        command: 'node -e "process.stdout.write(JSON.stringify({rpm_limit:7,rpm_remaining:3}))"',
        parse: ({ body }) => {
          const json = JSON.parse(body) as { rpm_limit: number; rpm_remaining: number };
          return { rpmLimit: json.rpm_limit, rpmRemaining: json.rpm_remaining };
        },
        path: '/whatever'
      },
      { timeoutMs: 2000 }
    );
    expect(result?.rpmLimit).toBe(7);
    expect(result?.rpmRemaining).toBe(3);
  });
});
