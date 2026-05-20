// Configuration loader for @agentsy/memory standalone mode
// Loads from (in priority order):
// 1. Constructor options (programmatic)
// 2. Environment variables (AGENTSY_MEMORY_*)
// 3. .agentsy/memory.env (project-level)
// 4. Built-in defaults

import type { DecayConfig } from './cognitive/decay.js';
import { DEFAULT_DECAY_CONFIG } from './cognitive/decay.js';
import type { TierName, TierConfig } from './cognitive/tier-types.js';
import type { TokenBudgetOptions } from './cognitive/token-budget.js';
import type { MemoryMCPServerOptions } from './mcp/server.js';

export interface MemoryConfig {
  db: {
    path: string;
    syncUrl?: string;
    syncAuthToken?: string;
    syncIntervalMs?: number;
  };
  tiers: Record<TierName, TierConfig>;
  budget: TokenBudgetOptions;
  decay: DecayConfig;
  mcp: MemoryMCPServerOptions;
  hooks: {
    onSessionStart: boolean;
    onSessionEnd: boolean;
    onToolCall: boolean;
    onResponse: boolean;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_TIER_CONFIGS: Record<TierName, TierConfig> = {
  sensory_buffer: {
    level: 1,
    name: 'sensory_buffer',
    maxTokens: 200,
    maxItems: 50,
    ttlMs: 5_000,
    consolidationThreshold: 0.6,
    compressionTarget: 0.5
  },
  sensory_register: {
    level: 2,
    name: 'sensory_register',
    maxTokens: 400,
    maxItems: 4,
    ttlMs: 2_000,
    consolidationThreshold: 0.5,
    compressionTarget: 0.4
  },
  working_memory: {
    level: 3,
    name: 'working_memory',
    maxTokens: 1_000,
    maxItems: 7,
    ttlMs: 30_000,
    consolidationThreshold: 0.4,
    compressionTarget: 0.3
  },
  short_term_memory: {
    level: 4,
    name: 'short_term_memory',
    maxTokens: 2_000,
    maxItems: 12,
    ttlMs: 3_600_000,
    consolidationThreshold: 0.3,
    compressionTarget: 0.2
  },
  long_term_memory: {
    level: 5,
    name: 'long_term_memory',
    maxTokens: Infinity,
    maxItems: Infinity,
    ttlMs: Infinity,
    consolidationThreshold: 0.0,
    compressionTarget: 0.0
  }
};

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === '1' || val === 'true' || val === 'yes';
}

/**
 * Load memory configuration with optional overrides.
 * Priority: overrides > env vars > defaults
 */
export function loadConfig(overrides?: Partial<MemoryConfig>): MemoryConfig {
  const dbPath = overrides?.db?.path ?? envString('AGENTSY_MEMORY_DB', '.agentsy/memory.db');
  const syncUrl = overrides?.db?.syncUrl ?? (process.env.AGENTSY_MEMORY_SYNC_URL || undefined);
  const syncAuthToken = overrides?.db?.syncAuthToken ?? (process.env.AGENTSY_MEMORY_SYNC_AUTH_TOKEN || undefined);
  const syncIntervalMs = overrides?.db?.syncIntervalMs ?? envNumber('AGENTSY_MEMORY_SYNC_INTERVAL_MS', 60_000);

  const transport = overrides?.mcp?.transport ?? (envString('AGENTSY_MEMORY_TRANSPORT', 'stdio') as 'stdio' | 'http');
  const port = overrides?.mcp?.port ?? envNumber('AGENTSY_MEMORY_PORT', 4231);
  const logLevel = overrides?.logLevel ?? (envString('AGENTY_MEMORY_LOG_LEVEL', 'info') as MemoryConfig['logLevel']);

  return {
    db: {
      path: dbPath,
      ...(syncUrl !== undefined ? { syncUrl } : {}),
      ...(syncAuthToken !== undefined ? { syncAuthToken } : {}),
      syncIntervalMs
    },
    tiers: overrides?.tiers ?? DEFAULT_TIER_CONFIGS,
    budget: overrides?.budget ?? { budgets: {} },
    decay: overrides?.decay ?? DEFAULT_DECAY_CONFIG,
    mcp: {
      transport,
      port,
      ...(dbPath ? { dbPath } : {}),
      ...(syncUrl ? { syncUrl } : {}),
      ...(syncAuthToken ? { syncAuthToken } : {}),
      logLevel:
        logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error' ? logLevel : 'info'
    },
    hooks: overrides?.hooks ?? {
      onSessionStart: envBool('AGENTSY_MEMORY_HOOK_SESSION_START', true),
      onSessionEnd: envBool('AGENTSY_MEMORY_HOOK_SESSION_END', true),
      onToolCall: envBool('AGENTSY_MEMORY_HOOK_TOOL_CALL', true),
      onResponse: envBool('AGENTSY_MEMORY_HOOK_RESPONSE', true)
    },
    logLevel:
      logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error' ? logLevel : 'info'
  };
}

export { DEFAULT_TIER_CONFIGS };
