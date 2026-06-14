import { getMemorySetupGuide, runMemoryDiagnostics } from '../../../memory/src/diagnostics/index.js';

import { getConfigSetupGuide, runConfigDiagnostics } from './config-diagnostics.js';
import type { DiagnosticReport, SetupGuide } from './types.js';

export type DiagnosticTarget = 'memory' | 'vscode' | 'config';

async function loadVSCodeDiagnostics(): Promise<{
  getVSCodeSetupGuide: () => SetupGuide;
  runVSCodeSettingsDiagnostics: () => DiagnosticReport;
}> {
  try {
    const mod: {
      getVSCodeSetupGuide: () => SetupGuide;
      runVSCodeSettingsDiagnostics: () => DiagnosticReport;
    } = await import('../../../vscode/src/settings/diagnostics.js');
    return mod;
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

  if (target === 'config') {
    return runConfigDiagnostics();
  }

  const vscode = await loadVSCodeDiagnostics();
  return vscode.runVSCodeSettingsDiagnostics();
}

export async function runAllDiagnostics(): Promise<DiagnosticReport[]> {
  return [
    await runDiagnosticsForTarget('memory'),
    await runDiagnosticsForTarget('vscode'),
    await runDiagnosticsForTarget('config')
  ];
}

export async function getSetupGuide(target: DiagnosticTarget): Promise<SetupGuide> {
  if (target === 'memory') {
    return getMemorySetupGuide();
  }

  if (target === 'config') {
    return getConfigSetupGuide();
  }

  const vscode = await loadVSCodeDiagnostics();
  return vscode.getVSCodeSetupGuide();
}

export async function getAllSetupGuides(): Promise<SetupGuide[]> {
  return [await getSetupGuide('memory'), await getSetupGuide('vscode'), await getSetupGuide('config')];
}
