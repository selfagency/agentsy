/**
 * @agentsy/plugins/manifest — Plugin manifest types and registry.
 *
 * This entry point provides the core plugin manifest contract types
 * and the registry implementation for discovering and managing
 * agent mode manifests.
 *
 * @module @agentsy/plugins/manifest
 */

export { createAgentManifestRegistry } from './registry.js';
export type {
  AgentManifest,
  AgentManifestRegistry,
  AgentMode,
  ExternalInstallation,
  PluginProvenance
} from './types.js';
