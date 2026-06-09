import { describe, expect, it } from 'vitest';

import { runMemoryConfigDiagnostics } from './config-diagnostics.js';

describe('runMemoryConfigDiagnostics', () => {
  it('returns at least one config check', () => {
    expect(runMemoryConfigDiagnostics().length).toBeGreaterThan(0);
  });
});
