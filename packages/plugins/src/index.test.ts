import { describe, expect, it } from 'vitest';

import {
  AgentLoader,
  AgentRegistry,
  agentManifest,
  BUILTIN_AGENT_DEFINITIONS,
  BUILTIN_AGENT_MANIFESTS,
  codeAgentDefinition,
  defaultAgentDefinition,
  planAgentManifest,
  plannerAgentDefinition,
  researchAgentDefinition,
  researchAgentManifest
} from './agents/index.js';
import { createAgentManifestRegistry, listManifestCapabilities, manifestExposesDiagnostics } from './index.js';

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

  it('exposes new AgentDefinition builtins', () => {
    expect(BUILTIN_AGENT_DEFINITIONS).toHaveLength(4);
    expect(defaultAgentDefinition.id).toBe('default');
    expect(researchAgentDefinition.id).toBe('research');
    expect(codeAgentDefinition.id).toBe('code');
    expect(plannerAgentDefinition.id).toBe('plan');
  });

  it('exposes AgentLoader and AgentRegistry classes', () => {
    expect(AgentLoader).toBeDefined();
    expect(AgentRegistry).toBeDefined();
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

  it('exposes manifest capability helpers from root module', () => {
    expect(typeof listManifestCapabilities).toBe('function');
    expect(typeof manifestExposesDiagnostics).toBe('function');
  });

  it('createAgentManifestRegistry creates an empty registry', () => {
    const registry = createAgentManifestRegistry();
    expect(registry.list()).toStrictEqual([]);
  });
});
