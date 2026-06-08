import { formatSetupGuide } from '../diagnostics/formatter.js';
import { toJson } from '../diagnostics/json.js';
import { type DiagnosticTarget, getAllSetupGuides, getSetupGuide } from '../diagnostics/registry.js';
import type { CliIO } from '../index.js';

function isDiagnosticTarget(value: string | undefined): value is DiagnosticTarget {
  return value === 'memory' || value === 'vscode';
}

export async function runSetupCommand(rest: readonly string[], io: CliIO): Promise<number> {
  const target = rest[0];
  const asJson = rest.includes('--json');
  const guides = isDiagnosticTarget(target) ? [await getSetupGuide(target)] : await getAllSetupGuides();
  const stdout = io.stdout ?? console.log;

  if (asJson) {
    stdout(toJson(guides));
    return 0;
  }

  for (const guide of guides) {
    for (const line of formatSetupGuide(guide)) {
      stdout(line);
    }
  }

  return 0;
}
