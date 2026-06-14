import { describe, expect, it } from 'vitest';

import { migrateConfigData } from './migrate.js';

describe('migrateConfigData', () => {
  it('handles unversioned configs (v0 → v1)', () => {
    const result = migrateConfigData({});
    expect(result.version).toBe(1);
    expect(result.budget).toEqual({ inputCap: 128_000, outputCap: 16_384 });
    expect(result.providers).toEqual([]);
  });

  it('leaves v1 configs unchanged', () => {
    const input = {
      version: 1,
      providers: [{ id: 'primary', type: 'openai' }],
      budget: { inputCap: 64_000, outputCap: 8192 },
      approvalPolicy: 'deny-all'
    };
    const result = migrateConfigData(input);
    expect(result.version).toBe(1);
    expect(result.providers).toHaveLength(1);
    expect(result.budget).toEqual({ inputCap: 64_000, outputCap: 8192 });
    expect(result.approvalPolicy).toBe('deny-all');
  });

  it('preserves existing fields during migration', () => {
    const input = { model: 'gpt-4', providers: [{ id: 'a', type: 'anthropic' }] };
    const result = migrateConfigData(input);
    expect(result.version).toBe(1);
    expect(result.model).toBe('gpt-4');
    expect(result.providers).toHaveLength(1);
  });
});
