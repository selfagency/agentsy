import { loadConfig } from '../config.js';
import type { MemoryDiagnosticCheck } from './types.js';

export function runMemoryDatabaseDiagnostics(): MemoryDiagnosticCheck[] {
  const config = loadConfig();
  return [
    {
      id: 'database-path',
      level: 'info',
      message: `Memory persistence path is ${config.db.path}.`
    }
  ];
}
