/**
 * XDG-compliant path resolution for Agentsy configuration, data, and cache.
 *
 * Follows the XDG Base Directory Specification:
 * - Config: $XDG_CONFIG_HOME/agentsy (default ~/.config/agentsy)
 * - Data:   $XDG_DATA_HOME/agentsy   (default ~/.local/share/agentsy)
 * - Cache:  $XDG_CACHE_HOME/agentsy  (default ~/.cache/agentsy)
 *
 * Also resolves project-local config roots for workspace/project overrides.
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function home(): string {
  return homedir();
}

function xdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME ?? resolve(home(), '.config');
}

function xdgDataHome(): string {
  return process.env.XDG_DATA_HOME ?? resolve(home(), '.local', 'share');
}

function xdgCacheHome(): string {
  return process.env.XDG_CACHE_HOME ?? resolve(home(), '.cache');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolved XDG paths for the Agentsy application.
 */
export const AGENTSY_PATHS = {
  /** User config directory: ~/.config/agentsy */
  config: resolve(xdgConfigHome(), 'agentsy'),
  /** User data directory: ~/.local/share/agentsy */
  data: resolve(xdgDataHome(), 'agentsy'),
  /** User cache directory: ~/.cache/agentsy */
  cache: resolve(xdgCacheHome(), 'agentsy')
} as const;

/**
 * Resolve the user-level config file path.
 */
export function userConfigPath(): string {
  return resolve(AGENTSY_PATHS.config, 'config.json');
}

/**
 * Resolve the project-level config file path for a given project root.
 */
export function projectConfigPath(projectDir: string): string {
  return resolve(projectDir, '.agentsy', 'config.json');
}

/**
 * Resolve the project-level policy file path for a given project root.
 */
export function projectPolicyPath(projectDir: string): string {
  return resolve(projectDir, '.agentsy', 'policy.yaml');
}

/**
 * Resolve the project-level agents directory for a given project root.
 */
export function projectAgentsDir(projectDir: string): string {
  return resolve(projectDir, '.agents');
}
