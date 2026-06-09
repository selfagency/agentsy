export interface MemoryDiagnosticCheck {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface MemoryDiagnosticsReport {
  checks: MemoryDiagnosticCheck[];
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  target: 'memory';
}
