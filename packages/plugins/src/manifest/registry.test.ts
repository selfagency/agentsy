import { describe, expect, it } from 'vitest';

import { createAgentManifestRegistry } from './registry.js';
import type { AgentManifest } from './types.js';

const sampleManifest: AgentManifest = {
  id: 'test/agent',
  name: 'Test Agent',
  mode: 'agent',
  description: 'A test agent manifest for unit testing'
};

const researchManifest: AgentManifest = {
  id: 'test/research',
  name: 'Test Research',
  mode: 'research',
  description: 'A test research manifest'
};

const planManifest: AgentManifest = {
  id: 'test/plan',
  name: 'Test Plan',
  mode: 'plan',
  description: 'A test plan manifest'
};

describe('createAgentManifestRegistry', () => {
  it('creates an empty registry when no initial manifests are provided', () => {
    const registry = createAgentManifestRegistry();

    expect(registry.manifests).toStrictEqual([]);
    expect(registry.list()).toStrictEqual([]);
  });

  it('seeds the registry with initial manifests', () => {
    const registry = createAgentManifestRegistry([sampleManifest]);

    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]).toBe(sampleManifest);
  });

  it('registers a new manifest and includes it in the list', () => {
    const registry = createAgentManifestRegistry();

    registry.register(sampleManifest);

    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.id).toBe('test/agent');
  });

  it('overwrites an existing manifest when registering a duplicate id', () => {
    const original: AgentManifest = {
      id: 'test/agent',
      name: 'Original',
      mode: 'agent',
      description: 'Original description'
    };

    const updated: AgentManifest = {
      id: 'test/agent',
      name: 'Updated',
      mode: 'agent',
      description: 'Updated description'
    };

    const registry = createAgentManifestRegistry([original]);

    registry.register(updated);

    expect(registry.list()).toHaveLength(1);
    const found = registry.getById('test/agent');
    expect(found?.name).toBe('Updated');
  });

  it('returns a manifest by id via getById', () => {
    const registry = createAgentManifestRegistry([sampleManifest]);

    const result = registry.getById('test/agent');

    expect(result).toBeDefined();
    expect(result?.id).toBe('test/agent');
    expect(result?.name).toBe('Test Agent');
  });

  it('returns undefined from getById for a non-existent id', () => {
    const registry = createAgentManifestRegistry();

    const result = registry.getById('non/existent');

    expect(result).toBeUndefined();
  });

  it('returns manifests filtered by mode via getByMode', () => {
    const registry = createAgentManifestRegistry([researchManifest, planManifest, sampleManifest]);

    const agents = registry.getByMode('agent');
    expect(agents).toHaveLength(1);
    expect(agents[0]?.id).toBe('test/agent');

    const research = registry.getByMode('research');
    expect(research).toHaveLength(1);
    expect(research[0]?.id).toBe('test/research');

    const plans = registry.getByMode('plan');
    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe('test/plan');
  });

  it('returns an empty array from getByMode when no manifests match', () => {
    const registry = createAgentManifestRegistry([sampleManifest]);

    const researchResults = registry.getByMode('research');

    expect(researchResults).toStrictEqual([]);
  });

  it('returns a copy of manifests from list() that cannot mutate the registry', () => {
    const registry = createAgentManifestRegistry([sampleManifest]);

    const listed = registry.list();
    listed.pop();

    // Registry should still have the original manifest
    expect(registry.list()).toHaveLength(1);
  });
});
