import { runMemoryConfigDiagnostics } from './config-diagnostics.js';
import { runMemoryDatabaseDiagnostics } from './database-diagnostics.js';
import { runMemoryMcpDiagnostics } from './mcp-diagnostics.js';
import { runMemorySyncDiagnostics } from './sync-diagnostics.js';
import type { MemoryDiagnosticsReport } from './types.js';

export type { MemoryDiagnosticCheck, MemoryDiagnosticsReport } from './types.js';

export function runMemoryDiagnostics(): MemoryDiagnosticsReport {
  const checks = [
    ...runMemoryConfigDiagnostics(),
    ...runMemoryDatabaseDiagnostics(),
    ...runMemoryMcpDiagnostics(),
    ...runMemorySyncDiagnostics()
  ];
  const hasError = checks.some(check => check.level === 'error');
  const hasWarn = checks.some(check => check.level === 'warn');

  let status: 'fail' | 'warn' | 'pass';
  if (hasError) {
    status = 'fail';
  } else if (hasWarn) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  let summary: string;
  if (hasError) {
    summary = 'Memory configuration reported one or more errors.';
  } else if (hasWarn) {
    summary = 'Memory configuration reported warnings.';
  } else {
    summary = 'Memory configuration checks passed.';
  }

  return {
    checks,
    status,
    summary,
    target: 'memory'
  };
}

export function getMemorySetupGuide(): { steps: string[]; summary: string; target: 'memory' } {
  return {
    target: 'memory',
    summary: 'Configure the local database path and optional sync settings.',
    steps: [
      'Set AGENTSY_MEMORY_DB or accept the default .agentsy/memory.db path.',
      'Choose stdio or http transport for the memory MCP surface.',
      'If using remote sync, configure AGENTSY_MEMORY_SYNC_URL and AGENTSY_MEMORY_SYNC_AUTH_TOKEN.',
      'Run `agentsy doctor memory` to validate the effective memory configuration.'
    ]
  };
}
