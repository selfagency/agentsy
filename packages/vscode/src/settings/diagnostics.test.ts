import { describe, expect, it } from 'vitest';

import { getVSCodeSetupGuide, runVSCodeSettingsDiagnostics } from './diagnostics.js';

describe('VS Code settings diagnostics', () => {
  it('passes when settings satisfy schema', () => {
    const report = runVSCodeSettingsDiagnostics({
      schema: { properties: { host: { type: 'string' } }, required: ['host'] },
      settings: { host: 'localhost' }
    });

    expect(report.status).toBe('pass');
  });

  it('fails when settings violate schema', () => {
    const report = runVSCodeSettingsDiagnostics({
      schema: { required: ['host'] },
      settings: {}
    });

    expect(report.status).toBe('fail');
  });

  it('returns setup guidance', () => {
    expect(getVSCodeSetupGuide().target).toBe('vscode');
  });
});
