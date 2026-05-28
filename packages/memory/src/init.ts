// Programmatic initialization for @agentsy/memory standalone mode
// Sets up engine, config, and optionally starts the MCP server

import { createMemoryEngine, type MemoryEngine, type MemoryEngineOptions } from './cognitive/memory-engine.js';
import type { TierName } from './cognitive/tier-types.js';
import { DEFAULT_TIER_CONFIGS, loadConfig, type MemoryConfig } from './config.js';
import { createMemoryMCPServer, type MemoryMCPServer, type MemoryMCPServerOptions } from './mcp/server.js';

export interface InitOptions {
  /** Override config with constructor options */
  config?: Partial<MemoryConfig>;
  /** Override engine creation options */
  engine?: MemoryEngineOptions;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip database initialization */
  skipDb?: boolean;
  /** Skip MCP server startup */
  skipMcp?: boolean;
}

export interface InitResultWithServer {
  config: MemoryConfig;
  engine: MemoryEngine;
  server: MemoryMCPServer;
}

export interface InitResultWithoutServer {
  config: MemoryConfig;
  engine: MemoryEngine;
}

export type InitResult = InitResultWithServer | InitResultWithoutServer;

/**
 * Initialize @agentsy/memory in standalone mode.
 * Creates a MemoryEngine with config, and optionally starts an MCP server.
 */
export function initMemory(options: InitOptions = {}): InitResult {
  const config = loadConfig(options.config);

  // Build engine options from config
  const engineOptions: MemoryEngineOptions = {
    ...options.engine
  };

  // Apply tier configs if provided
  if (options.config?.tiers && options.config.tiers !== DEFAULT_TIER_CONFIGS) {
    for (const [tierName, tierConfig] of Object.entries(options.config.tiers)) {
      const name = tierName as TierName;
      switch (name) {
        case 'sensory_buffer':
          engineOptions.sensoryBuffer = {
            ...tierConfig,
            now: engineOptions.now
          };
          break;
        case 'sensory_register':
          engineOptions.sensoryRegister = {
            ...tierConfig,
            now: engineOptions.now
          };
          break;
        case 'working_memory':
          engineOptions.workingMemory = {
            ...tierConfig,
            now: engineOptions.now
          };
          break;
        case 'short_term_memory':
          engineOptions.shortTermMemory = {
            ...tierConfig,
            now: engineOptions.now
          };
          break;
        case 'long_term_memory':
          engineOptions.longTermMemory = {
            ...tierConfig,
            now: engineOptions.now
          };
          break;
        default:
          break;
      }
    }
  }

  // Apply budget config
  if (options.config?.budget) {
    engineOptions.budget = config.budget;
  }

  // Apply decay config
  if (options.config?.decay) {
    engineOptions.decayConfig = config.decay;
  }

  const engine = createMemoryEngine(engineOptions);

  // Optionally create MCP server
  if (!options.skipMcp) {
    const serverOptions: MemoryMCPServerOptions = {
      ...config.mcp
    };
    const server = createMemoryMCPServer(engine, serverOptions);
    return { engine, config, server };
  }

  return { engine, config };
}

export type { MemoryConfig };
export { DEFAULT_TIER_CONFIGS, loadConfig };
