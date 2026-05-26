import { describe, expect, it } from 'vitest';

import { agentManifest, BUILTIN_AGENT_MANIFESTS, planAgentManifest, researchAgentManifest } from './agents/index.js';
import { createAgentManifestRegistry } from './index.js';

describe('@agentsy/plugins package entrypoints', () => {
  it('loads the root module and agents module without throwing', () => {
    expect(createAgentManifestRegistry).toBeDefined();
    expect(researchAgentManifest).toBeDefined();
  });

  it('exposes builtin agent manifest exports from agents sub-module', () => {
    expect(researchAgentManifest).toBeDefined();
    expect(planAgentManifest).toBeDefined();
    expect(agentManifest).toBeDefined();
    expect(BUILTIN_AGENT_MANIFESTS).toBeDefined();
  });

  it('exposes manifest type and registry exports from root module', () => {
    expect(createAgentManifestRegistry).toBeDefined();
  });

  it('researchAgentManifest has the correct mode', () => {
    expect(researchAgentManifest.mode).toBe('research');
  });

  it('planAgentManifest has the correct mode', () => {
    expect(planAgentManifest.mode).toBe('plan');
  });

  it('agentManifest has the correct mode', () => {
    expect(agentManifest.mode).toBe('agent');
  });

  it('BUILTIN_AGENT_MANIFESTS contains all three built-in manifests', () => {
    expect(BUILTIN_AGENT_MANIFESTS).toHaveLength(3);
  });

  it('createAgentManifestRegistry creates an empty registry', () => {
    const registry = createAgentManifestRegistry();
    expect(registry.list()).toStrictEqual([]);
  });
});
