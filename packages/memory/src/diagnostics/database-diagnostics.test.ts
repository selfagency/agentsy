import { describe, expect, it } from 'vitest';

import { runMemoryDatabaseDiagnostics } from './database-diagnostics.js';

describe('runMemoryDatabaseDiagnostics', () => {
  it('reports database path information', () => {
    expect(runMemoryDatabaseDiagnostics()[0]?.id).toBe('database-path');
  });
});
