import { getMemorySetupGuide, runMemoryDiagnostics } from '../../../memory/src/diagnostics/index.js';

import type { DiagnosticReport, SetupGuide } from './types.js';

export type DiagnosticTarget = 'memory' | 'vscode';

async function loadVSCodeDiagnostics(): Promise<{
  getVSCodeSetupGuide: () => SetupGuide;
  runVSCodeSettingsDiagnostics: () => DiagnosticReport;
}> {
  try {
    return (await import('../../../vscode/src/settings/diagnostics.js')) as {
      getVSCodeSetupGuide: () => SetupGuide;
      runVSCodeSettingsDiagnostics: () => DiagnosticReport;
    };
  } catch {
    return {
      getVSCodeSetupGuide: () => ({
        target: 'vscode',
        summary: 'VS Code integration package is not currently available in this environment.',
        steps: [
          'Add @agentsy/vscode to the workspace dependencies for the CLI package.',
          'Build the VS Code package so diagnostics helpers are resolvable.',
          'Run `agentsy doctor vscode` again after the package is available.'
        ]
      }),
      runVSCodeSettingsDiagnostics: () => ({
        target: 'vscode',
        status: 'warn',
        summary: 'VS Code diagnostics package is not currently available.',
        checks: [
          {
            id: 'package-resolution',
            level: 'warn',
            message: 'Unable to resolve VS Code diagnostics helpers from the workspace during this run.'
          }
        ]
      })
    };
  }
}

export async function runDiagnosticsForTarget(target: DiagnosticTarget): Promise<DiagnosticReport> {
  if (target === 'memory') {
    return runMemoryDiagnostics();
  }

  const vscode = await loadVSCodeDiagnostics();
  return vscode.runVSCodeSettingsDiagnostics();
}

export async function runAllDiagnostics(): Promise<DiagnosticReport[]> {
  return [await runDiagnosticsForTarget('memory'), await runDiagnosticsForTarget('vscode')];
}

export async function getSetupGuide(target: DiagnosticTarget): Promise<SetupGuide> {
  if (target === 'memory') {
    return getMemorySetupGuide();
  }

  const vscode = await loadVSCodeDiagnostics();
  return vscode.getVSCodeSetupGuide();
}

export async function getAllSetupGuides(): Promise<SetupGuide[]> {
  return [await getSetupGuide('memory'), await getSetupGuide('vscode')];
}
