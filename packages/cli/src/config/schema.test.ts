import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AGENTSY_PATHS, projectConfigPath, userConfigPath } from './paths.js';
import { DEFAULT_CONFIG, deepMerge, loadFromEnv } from './schema.js';

describe('AGENTSY_PATHS', () => {
  it('resolves config path', () => {
    expect(AGENTSY_PATHS.config).toContain('agentsy');
  });

  it('resolves data path', () => {
    expect(AGENTSY_PATHS.data).toContain('agentsy');
  });

  it('resolves cache path', () => {
    expect(AGENTSY_PATHS.cache).toContain('agentsy');
  });
});

describe('userConfigPath', () => {
  it('returns a path ending with config.json', () => {
    expect(userConfigPath()).toMatch(/config\.json$/);
  });
});

describe('projectConfigPath', () => {
  it('returns a path under .agentsy/', () => {
    expect(projectConfigPath('/tmp/project')).toBe('/tmp/project/.agentsy/config.json');
  });
});

describe('loadFromEnv', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns empty object when no AGENTSY_* vars are set', () => {
    delete process.env.AGENTSY_MODEL;
    delete process.env.AGENTSY_APPROVAL;
    delete process.env.AGENTSY_BUDGET_INPUT;
    delete process.env.AGENTSY_BUDGET_OUTPUT;
    expect(loadFromEnv()).toEqual({});
  });

  it('reads AGENTSY_MODEL', () => {
    process.env.AGENTSY_MODEL = 'gpt-4';
    expect(loadFromEnv().model).toBe('gpt-4');
  });

  it('reads AGENTSY_APPROVAL', () => {
    process.env.AGENTSY_APPROVAL = 'deny-all';
    expect(loadFromEnv().approvalPolicy).toBe('deny-all');
  });

  it('ignores invalid AGENTSY_APPROVAL', () => {
    process.env.AGENTSY_APPROVAL = 'invalid';
    expect(loadFromEnv().approvalPolicy).toBeUndefined();
  });

  it('reads AGENTSY_BUDGET_INPUT and AGENTSY_BUDGET_OUTPUT', () => {
    process.env.AGENTSY_BUDGET_INPUT = '64000';
    process.env.AGENTSY_BUDGET_OUTPUT = '8192';
    const env = loadFromEnv();
    expect(env.budget).toEqual({ inputCap: 64_000, outputCap: 8192 });
  });
});

describe('deepMerge', () => {
  it('merges defaults with overrides', () => {
    const result = deepMerge(DEFAULT_CONFIG as Record<string, unknown>, {
      model: 'claude-4'
    });
    expect(result.model).toBe('claude-4');
    expect(result.version).toBe(1);
    expect(result.approvalPolicy).toBe('deny-destructive');
  });

  it('later sources override earlier ones', () => {
    const result = deepMerge(
      { approvalPolicy: 'deny-all' } as Record<string, unknown>,
      { approvalPolicy: 'deny-none' } as Record<string, unknown>
    );
    expect(result.approvalPolicy).toBe('deny-none');
  });

  it('deep-merges nested objects', () => {
    const result = deepMerge(
      { budget: { inputCap: 128_000, outputCap: 16_384 } } as Record<string, unknown>,
      { budget: { inputCap: 64_000 } } as Record<string, unknown>
    );
    expect(result.budget).toEqual({ inputCap: 64_000, outputCap: 16_384 });
  });

  it('replaces arrays rather than merging', () => {
    const result = deepMerge(
      { providers: [{ id: 'a', type: 'openai' }] } as Record<string, unknown>,
      { providers: [{ id: 'b', type: 'anthropic' }] } as Record<string, unknown>
    );
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0]?.id).toBe('b');
  });
});
