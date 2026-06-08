/**
 * Plugin manifest types for the superagents plugin contract.
 *
 * Defines the structure for agent mode manifests, provenance metadata,
 * and external installation semantics used across the plugin system.
 *
 * @module @agentsy/plugins/manifest
 */

/**
 * Mode type for a superagent.
 */
export type AgentMode = 'research' | 'plan' | 'agent';

/**
 * Provenance metadata for plugin origin tracking.
 */
export interface PluginProvenance {
  /** When the plugin was installed (ISO date). */
  installedAt: string;

  /** Integrity hash for supply chain verification. */
  integrity?: string;

  /** Publisher identifier. */
  publisher?: string;
  /** Where the plugin was installed from (npm registry URL, GitHub repo, local path). */
  source: string;

  /** Plugin version (semver). */
  version: string;
}

/**
 * External installation semantics for a plugin manifest.
 */
export interface ExternalInstallation {
  /** Minimum host version required (e.g., { '@agentsy/core': '>=0.5.0' }). */
  engineRequirements?: Record<string, string>;
  /** Package manager install command (e.g., 'npm install @agentsy/plugin-official'). */
  installCommand: string;

  /** Post-install setup instructions. */
  setupInstructions?: string;
}

/**
 * Optional diagnostics metadata for outer-layer operator tooling.
 */
export interface ManifestDiagnosticsMetadata {
  commandHint?: string;
  supported?: boolean;
}

/**
 * A superagent mode manifest describing an agent's capabilities, tools, and behavior.
 */
export interface AgentManifest {
  /** Allowed tool categories. */
  allowedTools?: string[];

  /** Optional capability tags for integration or harness negotiation. */
  capabilities?: string[];

  /** Default model preferences. */
  defaultModel?: string;

  /** Description of what this agent does. */
  description: string;

  /** Optional diagnostics metadata surfaced to outer operator tooling. */
  diagnostics?: ManifestDiagnosticsMetadata;

  /** Optional host targets this manifest is intended for. */
  hostTargets?: string[];
  /** Unique identifier (e.g., 'superagents/research'). */
  id: string;

  /** Installation semantics for external consumers. */
  installation?: ExternalInstallation;

  /** Memory scope for this agent mode. */
  memoryScope?: 'session' | 'project' | 'global';

  /** Mode type. */
  mode: AgentMode;

  /** Human-readable name. */
  name: string;

  /** Provenance metadata. */
  provenance?: PluginProvenance;

  /** Whether this requires user approval for actions. */
  requiresApproval?: boolean;

  /** Optional setup hints for host tooling. */
  setupHints?: string[];

  /** System prompt template or reference. */
  systemPrompt?: string;
}

/**
 * Registry of all agent manifests with lookup and registration methods.
 */
export interface AgentManifestRegistry {
  /** Look up a manifest by its unique id. */
  getById(id: string): AgentManifest | undefined;

  /** Get all manifests matching a given mode. */
  getByMode(mode: AgentMode): AgentManifest[];

  /** List all registered manifests. */
  list(): AgentManifest[];
  /** All registered manifests. */
  manifests: AgentManifest[];

  /** Register a new manifest in the registry. */
  register(manifest: AgentManifest): void;
}
