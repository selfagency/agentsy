import { describe, expect, it } from 'vitest';
import { BUILTIN_GUARDRAIL_URIS, GuardrailHub, parseHubUri } from './hub.js';
import type { GuardrailScanner } from './types.js';

describe('parseHubUri', () => {
  it('parses hub://guardrails/prompt_injection', () => {
    const parsed = parseHubUri('hub://guardrails/prompt_injection');
    expect(parsed).not.toBeNull();
    expect(parsed?.scheme).toBe('hub');
    expect(parsed?.packageName).toBe('guardrails/prompt_injection');
    expect(parsed?.version).toBeUndefined();
  });

  it('parses hub://guardrails/prompt_injection@1.0 with version', () => {
    const parsed = parseHubUri('hub://guardrails/prompt_injection@1.0');
    expect(parsed).not.toBeNull();
    expect(parsed?.packageName).toBe('guardrails/prompt_injection');
    expect(parsed?.version).toBe('1.0');
  });

  it('returns null for invalid URIs', () => {
    expect(parseHubUri('')).toBeNull();
    expect(parseHubUri('not-a-uri')).toBeNull();
    expect(parseHubUri('http://example.com')).toBeNull();
  });
});

describe('GuardrailHub', () => {
  it('install and resolve a guardrail', async () => {
    const hub = new GuardrailHub();
    const factory = () =>
      Promise.resolve({
        metadata: {
          id: 'hub://test/my_scanner@1.0',
          name: 'My Scanner',
          version: '1.0.0',
          description: 'A test scanner',
          priority: 50,
          owaspCategories: [],
          tags: []
        },
        evaluate: async () => ({ status: 'pass' as const, phase: 'input' as const })
      });
    hub.install('hub://test/my_scanner@1.0', 'My Scanner', 'A test scanner', factory);
    const scanner = await hub.resolve('hub://test/my_scanner@1.0');
    expect(scanner).not.toBeNull();
    expect(scanner?.metadata.name).toBe('My Scanner');
    // Guard: scanner is guaranteed non-null by the assertion above
    if (scanner === null) {
      throw new Error('Expected scanner to be resolved');
    }
    const result = await scanner.evaluate('test');
    expect(result.status).toBe('pass');
  });

  it('resolve returns null for missing URI', async () => {
    const hub = new GuardrailHub();
    const scanner = await hub.resolve('hub://test/missing');
    expect(scanner).toBeNull();
  });

  it('uninstall removes a guardrail', () => {
    const hub = new GuardrailHub();
    hub.install('hub://test/temp', 'Temp', '', () => ({
      metadata: {
        id: 'hub://test/temp',
        name: 'Temp',
        version: '1.0.0',
        description: '',
        priority: 1,
        owaspCategories: [],
        tags: []
      },
      evaluate: () => ({ status: 'pass' as const, phase: 'input' as const })
    }));
    expect(hub.isInstalled('hub://test/temp')).toBe(true);
    hub.uninstall('hub://test/temp');
    expect(hub.isInstalled('hub://test/temp')).toBe(false);
  });

  it('listInstalled returns all entries', () => {
    const hub = new GuardrailHub();
    hub.install('hub://test/a', 'A', '', () => ({}) as GuardrailScanner);
    hub.install('hub://test/b', 'B', '', () => ({}) as GuardrailScanner);
    expect(hub.listInstalled()).toHaveLength(2);
  });

  it('clear removes all entries', () => {
    const hub = new GuardrailHub();
    hub.install('hub://test/x', 'X', '', () => ({}) as GuardrailScanner);
    hub.clear();
    expect(hub.size).toBe(0);
  });

  it('resolveAll resolves multiple URIs', async () => {
    const hub = new GuardrailHub();
    hub.install('hub://test/a', 'A', '', () =>
      Promise.resolve({
        metadata: {
          id: 'hub://test/a',
          name: 'A',
          version: '1.0.0',
          description: '',
          priority: 1,
          owaspCategories: [],
          tags: []
        },
        evaluate: async () => ({ status: 'pass' as const, phase: 'input' as const })
      })
    );
    hub.install('hub://test/b', 'B', '', () =>
      Promise.resolve({
        metadata: {
          id: 'hub://test/b',
          name: 'B',
          version: '1.0.0',
          description: '',
          priority: 1,
          owaspCategories: [],
          tags: []
        },
        evaluate: async () => ({ status: 'pass' as const, phase: 'input' as const })
      })
    );
    const results = await hub.resolveAll(['hub://test/a', 'hub://test/b', 'hub://test/missing']);
    expect(results).toHaveLength(3);
    expect(results[0]).not.toBeNull();
    expect(results[1]).not.toBeNull();
    expect(results[2]).toBeNull();
  });
});

describe('BUILTIN_GUARDRAIL_URIS', () => {
  it('exports expected URIs', () => {
    expect(BUILTIN_GUARDRAIL_URIS.PROMPT_INJECTION).toBe('hub://guardrails/prompt_injection@1.0');
    expect(BUILTIN_GUARDRAIL_URIS.PII).toBe('hub://guardrails/pii_detection@1.0');
    expect(BUILTIN_GUARDRAIL_URIS.RATE_LIMITER).toBe('hub://guardrails/rate_limiter@1.0');
  });
});
