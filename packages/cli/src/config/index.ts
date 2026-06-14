/**
 * Configuration system for @agentsy/cli.
 *
 * ## Usage
 *
 * ```typescript
 * import { loadConfig } from '@agentsy/cli/config';
 *
 * const config = await loadConfig();
 * console.log(config.approvalPolicy); // 'deny-destructive'
 * ```
 *
 * ## Layering
 *
 * 1. Built-in defaults (lowest priority)
 * 2. User config: ~/.config/agentsy/config.json
 * 3. Project config: .agentsy/config.json
 * 4. Environment variables: AGENTSY_* (highest priority)
 *
 * ## Security
 *
 * Config files NEVER store plaintext secrets. Provider credentials are
 * referenced via `secretRef` or `secretId` and resolved at runtime through
 * @agentsy/secrets CredentialBroker.
 */

export { CURRENT_CONFIG_VERSION, migrateAndLoad, migrateConfigData, migrateConfigFile } from './migrate.js';
export { AGENTSY_PATHS, projectAgentsDir, projectConfigPath, projectPolicyPath, userConfigPath } from './paths.js';
export { createEnvKeyring, resolveProviderCredential } from './resolve-credentials.js';
export type { ApprovalPolicy, BudgetConfig, Config, ProviderConfig } from './schema.js';
export {
  ConfigSchema,
  DEFAULT_CONFIG,
  deepMerge,
  loadConfig,
  loadFromEnv,
  loadFromFile
} from './schema.js';
