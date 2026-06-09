import type { HelperRoleDefinition } from './types.js';

export interface HelperRoleRegistry {
  get(id: string): HelperRoleDefinition | undefined;
  list(): HelperRoleDefinition[];
  register(helper: HelperRoleDefinition): void;
}

export function createHelperRoleRegistry(initial: HelperRoleDefinition[] = []): HelperRoleRegistry {
  const registry = new Map(initial.map(helper => [helper.id, helper]));

  return {
    get(id) {
      return registry.get(id);
    },
    list() {
      return [...registry.values()];
    },
    register(helper) {
      registry.set(helper.id, helper);
    }
  };
}
