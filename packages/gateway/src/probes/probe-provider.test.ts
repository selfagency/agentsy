import type { ProviderProfile, UsageProbe } from '@agentsy/providers/profiles';
import { describe, expect, it } from 'vitest';

import { probeProvider, probesAreEmpty } from './probe-provider.js';

function profile(probes: UsageProbe[]): ProviderProfile {
  return {
    errorClassifier: () => 'ok',
    headers: {},
    id: 'p',
    name: 'P',
    provider: 'openai',
    usageProbes: probes
  };
}

describe('probeProvider', () => {
  it('returns null when no probes succeed', async () => {
    const p = profile([
      { kind: 'api', path: '/v1/me/rate_limit' },
      { kind: 'api', path: '/usage' }
    ]);
    const result = await probeProvider(p, {
      baseUrl: 'https://api.example.com',
      fetch: (async () => new Response('{}', { status: 403 })) as unknown as typeof globalThis.fetch
    });
    expect(result).toBeNull();
  });

  it('merges results across multiple probes', async () => {
    const p = profile([
      {
        kind: 'api',
        parse: () => ({ rpmLimit: 60, rpmRemaining: 50 }),
        path: '/v1/me/rate_limit'
      },
      {
        kind: 'api',
        parse: () => ({ tpmLimit: 1000, tpmRemaining: 800 }),
        path: '/usage'
      }
    ]);
    const fetchImpl = (async () => new Response('{}', { status: 200 })) as unknown as typeof globalThis.fetch;
    const result = await probeProvider(p, { baseUrl: 'https://api.example.com', fetch: fetchImpl });
    expect(result).toEqual({
      creditsRemaining: undefined,
      rpmLimit: 60,
      rpmRemaining: 50,
      tpmLimit: 1000,
      tpmRemaining: 800
    });
  });

  it('returns the snapshot from the first successful probe when others fail', async () => {
    const p = profile([
      {
        kind: 'api',
        parse: () => ({ rpmLimit: 60, rpmRemaining: 50 }),
        path: '/working'
      },
      {
        kind: 'api',
        path: '/broken'
      }
    ]);
    let calls = 0;
    const fetchImpl = (() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 500 }));
    }) as unknown as typeof globalThis.fetch;
    const result = await probeProvider(p, { baseUrl: 'https://api.example.com', fetch: fetchImpl });
    expect(result?.rpmLimit).toBe(60);
  });

  it('returns null when the profile declares no probes', async () => {
    const result = await probeProvider(profile([]), {});
    expect(result).toBeNull();
  });
});

describe('probesAreEmpty', () => {
  it('returns true for an empty list', () => {
    expect(probesAreEmpty([])).toBe(true);
  });

  it('returns false when at least one probe is declared', () => {
    expect(probesAreEmpty([{ kind: 'api', path: '/x' }])).toBe(false);
  });
});
