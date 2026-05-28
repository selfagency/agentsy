import type { AgentManifest, AgentManifestRegistry, AgentMode } from './types.js';

/**
 * Creates a new {@link AgentManifestRegistry} with an optional set of initial manifests.
 *
 * The registry provides O(n) lookup by id and filtered retrieval by mode.
 * Duplicate ids are silently overwritten on register — the latest registration wins.
 *
 * @param initialManifests - Optional array of manifests to seed the registry with.
 * @returns A new AgentManifestRegistry instance.
 */
export function createAgentManifestRegistry(initialManifests?: AgentManifest[]): AgentManifestRegistry {
  const manifests: AgentManifest[] = initialManifests ? [...initialManifests] : [];

  return {
    manifests,

    register(manifest: AgentManifest): void {
      const existingIndex = manifests.findIndex(m => m.id === manifest.id);

      if (existingIndex >= 0) {
        manifests[existingIndex] = manifest;
      } else {
        manifests.push(manifest);
      }
    },

    getById(id: string): AgentManifest | undefined {
      return manifests.find(m => m.id === id);
    },

    getByMode(mode: AgentMode): AgentManifest[] {
      return manifests.filter(m => m.mode === mode);
    },

    list(): AgentManifest[] {
      return [...manifests];
    }
  };
}
