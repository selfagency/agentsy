/**
 * Schema versioning and migration for Agentsy config files.
 *
 * ## Version history
 *
 * - 1: Initial schema (Phase 10). Providers as array, budget, approval policy, UI prefs.
 *
 * ## Usage
 *
 * ```typescript
 * import { migrateConfig } from './migrate.js';
 * const migrated = await migrateConfig(rawConfig);
 * ```
 *
 * Migration runs automatically during `loadConfig` — no manual steps needed.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { userConfigPath } from './paths.js';
import { type Config, ConfigSchema } from './schema.js';

// =============================================================================
// Migration registry
// =============================================================================

interface Migration {
  /** Source version (the version this migration applies FROM). */
  from: number;
  /** Migration function — transforms raw data from `from` → `to`. */
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
  /** Target version after applying this migration. */
  to: number;
}

/**
 * Registered migrations. Ordered by `from` ascending.
 * When a config file has `version: N`, all migrations with `from >= N`
 * are applied in sequence until the current version is reached.
 */
const MIGRATIONS: Migration[] = [
  // v0 → v1: Unversioned configs get the default v1 shape
  {
    from: 0,
    to: 1,
    migrate: (data: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = { ...data, version: 1 };

      // Ensure budget defaults
      if (!result.budget || typeof result.budget !== 'object') {
        result.budget = { inputCap: 128_000, outputCap: 16_384 };
      }

      // Ensure providers is an array
      if (!Array.isArray(result.providers)) {
        result.providers = [];
      }

      return result;
    }
  }
];

// =============================================================================
// Migration runner
// =============================================================================

/**
 * Current config schema version.
 */
export const CURRENT_CONFIG_VERSION = 1;

/**
 * Migrate a config file from its current version to the latest version.
 *
 * @param data - Raw parsed config data (may be unversioned).
 * @returns The migrated config data.
 */
export function migrateConfigData(data: Record<string, unknown>): Record<string, unknown> {
  const currentVersion = (data.version as number | undefined) ?? 0;
  let result = { ...data };

  for (const migration of MIGRATIONS) {
    if (currentVersion < migration.to && currentVersion <= migration.from) {
      result = migration.migrate(result);
    }
  }

  return result;
}

// =============================================================================
// File-level migration (writes back)
// =============================================================================

/**
 * Read, migrate, and write back a config file if migration was needed.
 *
 * @param filePath - Path to the config JSON file.
 * @returns The migrated config, or null if the file doesn't exist.
 */
export async function migrateConfigFile(filePath: string): Promise<Config | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const raw = await readFile(filePath, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const beforeVersion = (data.version as number | undefined) ?? 0;
  const migrated = migrateConfigData(data);
  const afterVersion = (migrated.version as number | undefined) ?? 0;

  if (beforeVersion !== afterVersion) {
    await writeFile(filePath, `${JSON.stringify(migrated, null, 2)}\n`, 'utf-8');
  }

  const parsed = ConfigSchema.safeParse(migrated);
  if (!parsed.success) {
    throw new Error(`Config migration produced invalid config: ${parsed.error.message}`);
  }

  return parsed.data;
}

/**
 * Migrate both user and project config files, then return the merged result.
 * Called automatically by `loadConfig` — no manual invocation needed.
 */
export async function migrateAndLoad(projectDir?: string): Promise<Config> {
  const { loadConfig } = await import('./schema.js');
  const userFile = userConfigPath();
  const projectRoot = projectDir ?? process.cwd();
  const { projectConfigPath } = await import('./paths.js');
  const projectFile = projectConfigPath(projectRoot);

  // Migrate files in parallel
  await Promise.all([migrateConfigFile(userFile), migrateConfigFile(projectFile)]);

  return loadConfig(projectDir);
}
