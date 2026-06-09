import { loadConfig } from '../config.js';
import type { MemoryDiagnosticCheck } from './types.js';

export function runMemorySyncDiagnostics(): MemoryDiagnosticCheck[] {
  const config = loadConfig();
  if (!config.db.syncUrl) {
    return [
      {
        id: 'sync-disabled',
        level: 'info',
        message: 'Remote sync is not configured.'
      }
    ];
  }

  return [
    {
      id: 'sync-url',
      level: 'info',
      message: `Remote sync URL is ${config.db.syncUrl}.`
    },
    {
      id: 'sync-auth-token',
      level: config.db.syncAuthToken ? 'info' : 'warn',
      message: config.db.syncAuthToken
        ? 'Remote sync auth token is configured.'
        : 'Remote sync auth token is not configured.'
    }
  ];
}
