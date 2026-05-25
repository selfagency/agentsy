import { describe, expect, it } from 'vitest';

import * as agents from './agents/index.js';
import * as plugins from './index.js';

describe('@agentsy/plugins package entrypoints', () => {
  it('loads the root module and agents module without throwing', () => {
    expect(plugins).toBeDefined();
    expect(agents).toBeDefined();
  });

  it('exposes builtin agent manifest exports from agents sub-module', () => {
    expect(Object.keys(agents)).toContain('researchAgentManifest');
    expect(Object.keys(agents)).toContain('planAgentManifest');
    expect(Object.keys(agents)).toContain('agentManifest');
    expect(Object.keys(agents)).toContain('BUILTIN_AGENT_MANIFESTS');
  });

  it('exposes manifest type and registry exports from root module', () => {
    expect(plugins.createAgentManifestRegistry).toBeDefined();
  });

  it('researchAgentManifest has the correct mode', () => {
    expect(agents.researchAgentManifest.mode).toBe('research');
  });

  it('planAgentManifest has the correct mode', () => {
    expect(agents.planAgentManifest.mode).toBe('plan');
  });

  it('agentManifest has the correct mode', () => {
    expect(agents.agentManifest.mode).toBe('agent');
  });

  it('BUILTIN_AGENT_MANIFESTS contains all three built-in manifests', () => {
    expect(agents.BUILTIN_AGENT_MANIFESTS).toHaveLength(3);
  });

  it('createAgentManifestRegistry creates an empty registry', () => {
    const registry = plugins.createAgentManifestRegistry();
    expect(registry.list()).toStrictEqual([]);
  });
});
