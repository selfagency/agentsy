import { loadConfig } from '../config.js';
import type { MemoryDiagnosticCheck } from './types.js';

export function runMemoryConfigDiagnostics(): MemoryDiagnosticCheck[] {
  const config = loadConfig();
  return [
    {
      id: 'db-path',
      level: config.db.path.endsWith('.db') ? 'info' : 'warn',
      message: config.db.path.endsWith('.db')
        ? `Memory database path is configured as ${config.db.path}.`
        : `Memory database path ${config.db.path} does not end with .db.`
    },
    {
      id: 'log-level',
      level: config.logLevel === 'debug' ? 'warn' : 'info',
      message: `Memory log level is ${config.logLevel}.`
    }
  ];
}
