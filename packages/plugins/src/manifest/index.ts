/**
 * @agentsy/plugins/manifest — Plugin manifest types and registry.
 *
 * This entry point provides the core plugin manifest contract types
 * and the registry implementation for discovering and managing
 * agent mode manifests.
 *
 * @module @agentsy/plugins/manifest
 */

export type {
  AgentMode,
  AgentManifest,
  AgentManifestRegistry,
  ExternalInstallation,
  PluginProvenance
} from './types.js';

export { createAgentManifestRegistry } from './registry.js';
