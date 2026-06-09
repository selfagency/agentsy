import type { DiagnosticReport, SetupGuide } from './types.js';

export function formatDiagnosticReport(report: DiagnosticReport): string[] {
  return [
    `${report.target}: ${report.status.toUpperCase()} — ${report.summary}`,
    ...report.checks.map(check => `- [${check.level}] ${check.id}: ${check.message}`)
  ];
}

export function formatSetupGuide(guide: SetupGuide): string[] {
  return [`${guide.target}: ${guide.summary}`, ...guide.steps.map((step, index) => `${index + 1}. ${step}`)];
}
