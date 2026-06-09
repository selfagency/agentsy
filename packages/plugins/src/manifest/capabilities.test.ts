import { describe, expect, it } from 'vitest';

import { listManifestCapabilities, manifestExposesDiagnostics, manifestSupportsHostTarget } from './capabilities.js';

describe('manifest capability helpers', () => {
  const manifest = {
    id: 'test/agent',
    name: 'Test',
    mode: 'agent' as const,
    description: 'desc',
    capabilities: ['doctor', 'setup'],
    hostTargets: ['vscode'],
    diagnostics: { supported: true }
  };

  it('lists capabilities', () => {
    expect(listManifestCapabilities(manifest)).toStrictEqual(['doctor', 'setup']);
  });

  it('checks host targets', () => {
    expect(manifestSupportsHostTarget(manifest, 'vscode')).toBe(true);
    expect(manifestSupportsHostTarget(manifest, 'mcp')).toBe(false);
  });

  it('checks diagnostics support', () => {
    expect(manifestExposesDiagnostics(manifest)).toBe(true);
  });
});
