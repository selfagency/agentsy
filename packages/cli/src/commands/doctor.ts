import { formatDiagnosticReport } from '../diagnostics/formatter.js';
import { toJson } from '../diagnostics/json.js';
import { type DiagnosticTarget, runAllDiagnostics, runDiagnosticsForTarget } from '../diagnostics/registry.js';
import type { CliIO } from '../index.js';

function isDiagnosticTarget(value: string | undefined): value is DiagnosticTarget {
  return value === 'memory' || value === 'vscode';
}

export async function runDoctorCommand(rest: readonly string[], io: CliIO): Promise<number> {
  const target = rest[0];
  const asJson = rest.includes('--json');
  const reports = isDiagnosticTarget(target) ? [await runDiagnosticsForTarget(target)] : await runAllDiagnostics();
  const hasFailure = reports.some(report => report.status === 'fail');
  const stdout = io.stdout ?? console.log;

  if (asJson) {
    stdout(toJson(reports));
    return hasFailure ? 1 : 0;
  }

  for (const report of reports) {
    for (const line of formatDiagnosticReport(report)) {
      stdout(line);
    }
  }

  return hasFailure ? 1 : 0;
}
