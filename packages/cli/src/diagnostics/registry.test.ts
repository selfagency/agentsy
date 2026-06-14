import { describe, expect, it } from 'vitest';

import { getAllSetupGuides, runAllDiagnostics } from './registry.js';

describe('diagnostics registry', () => {
  it('returns setup guides', async () => {
    expect((await getAllSetupGuides()).map(guide => guide.target)).toStrictEqual(['memory', 'vscode', 'config']);
  });

  it('runs diagnostics for registered targets', async () => {
    const reports = await runAllDiagnostics();
    expect(reports).toHaveLength(3);
  });
});
