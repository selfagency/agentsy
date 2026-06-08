export type DiagnosticLevel = 'info' | 'warn' | 'error';
export type DiagnosticStatus = 'pass' | 'warn' | 'fail';

export interface DiagnosticCheck {
  id: string;
  level: DiagnosticLevel;
  message: string;
}

export interface DiagnosticReport {
  checks: DiagnosticCheck[];
  status: DiagnosticStatus;
  summary: string;
  target: string;
}

export interface SetupGuide {
  steps: string[];
  summary: string;
  target: string;
}
