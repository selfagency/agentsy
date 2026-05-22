// Programmatic initialization for @agentsy/memory standalone mode
// Sets up engine, config, and optionally starts the MCP server

import { initAgentFs } from './agentfs/init.js';
import { createMemoryEngine, type MemoryEngine, type MemoryEngineOptions } from './cognitive/memory-engine.js';
import type { TierName } from './cognitive/tier-types.js';
import { loadConfig, type MemoryConfig, DEFAULT_TIER_CONFIGS } from './config.js';
import type { ConnectionOptions } from './database/connection.js';
import { createDatabaseConnection, runMigrations, type MemoryDatabase } from './database/index.js';
import { createMemoryMCPServer, type MemoryMCPServer, type MemoryMCPServerOptions } from './mcp/server.js';
import { createKnowledgeBaseManager, type KnowledgeBaseManager } from './retrieval/rag/knowledge-base.js';
import { createTursoSyncEngine, type TursoSyncEngine, type TursoSyncEngineConfig } from './sync/turso-sync-engine.js';
import { createWikiManager, type WikiManager } from './wiki/wiki-manager.js';

export interface InitOptions {
  /** Override config with constructor options */
  config?: Partial<MemoryConfig>;
  /** Override engine creation options */
  engine?: MemoryEngineOptions;
  /** Skip MCP server startup */
  skipMcp?: boolean;
  /** Skip database initialization */
  skipDb?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Override database connection options */
  db?: ConnectionOptions;
  /** Optional Turso sync overrides. If omitted, falls back to config.db.syncUrl/syncAuthToken. */
  tursoSync?: Partial<TursoSyncEngineConfig>;
}

export interface InitResultWithServer {
  engine: MemoryEngine;
  config: MemoryConfig;
  server: MemoryMCPServer;
  db?: MemoryDatabase;
  wiki?: WikiManager;
  knowledgeBase?: KnowledgeBaseManager;
  tursoSyncEngine?: TursoSyncEngine;
}

export interface InitResultWithoutServer {
  engine: MemoryEngine;
  config: MemoryConfig;
  db?: MemoryDatabase;
  wiki?: WikiManager;
  knowledgeBase?: KnowledgeBaseManager;
  tursoSyncEngine?: TursoSyncEngine;
}

export type InitResult = InitResultWithServer | InitResultWithoutServer;

/**
 * Initialize @agentsy/memory in standalone mode.
 * Creates a MemoryEngine with config, an optional SQLite database, and optionally starts an MCP server.
 */
export async function initMemory(options: InitOptions = {}): Promise<InitResult> {
  const config = loadConfig(options.config);

  let db: MemoryDatabase | undefined;

  let useAgentFs = false;
  let dbPath = ':memory:';

  if (!options.skipDb) {
    dbPath = options.db?.path ?? config.db.path;
    const { sqlite, db: drizzleDb } = createDatabaseConnection({
      ...options.db,
      path: dbPath
    });
    runMigrations(sqlite);
    const agentFsStatus = initAgentFs({ sqlite });
    useAgentFs = agentFsStatus.hasAgentFsTables;
    db = drizzleDb;
  }

  // Build engine options from config
  const engineOptions: MemoryEngineOptions = {
    ...options.engine,
    ...(db === undefined ? {} : { db }),
    ...(useAgentFs ? { useAgentFs } : {})
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

  let wiki: WikiManager | undefined;
  let knowledgeBase: KnowledgeBaseManager | undefined;
  let tursoSyncEngine: TursoSyncEngine | undefined;

  if (db !== undefined) {
    wiki = createWikiManager({ db, useAgentFs });
    knowledgeBase = createKnowledgeBaseManager({ db, useAgentFs });
  }

  // Phase 8c — wire Turso sync engine when config provides a sync URL and we have a real file DB
  if (!options.skipDb && dbPath !== ':memory:') {
    const syncUrl = options.tursoSync?.url ?? config.db.syncUrl;
    const syncAuthToken = options.tursoSync?.authToken ?? config.db.syncAuthToken;

    if (syncUrl) {
      tursoSyncEngine = await createTursoSyncEngine({
        path: dbPath,
        url: syncUrl,
        ...(syncAuthToken ? { authToken: syncAuthToken } : {}),
        clientName: options.tursoSync?.clientName ?? 'agentsy-memory'
      });
    }
  }

  // Optionally create MCP server
  if (!options.skipMcp) {
    const serverOptions: MemoryMCPServerOptions = {
      ...config.mcp,
      ...(db === undefined ? {} : { db })
    };
    const server = await createMemoryMCPServer({ engine, wiki, kb: knowledgeBase, options: serverOptions });
    return {
      engine,
      config,
      server,
      ...(db === undefined ? {} : { db }),
      ...(wiki === undefined ? {} : { wiki }),
      ...(knowledgeBase === undefined ? {} : { knowledgeBase }),
      ...(tursoSyncEngine === undefined ? {} : { tursoSyncEngine })
    };
  }

  return {
    engine,
    config,
    ...(db === undefined ? {} : { db }),
    ...(wiki === undefined ? {} : { wiki }),
    ...(knowledgeBase === undefined ? {} : { knowledgeBase }),
    ...(tursoSyncEngine === undefined ? {} : { tursoSyncEngine })
  };
}

export { loadConfig, DEFAULT_TIER_CONFIGS };
export type { MemoryConfig };
