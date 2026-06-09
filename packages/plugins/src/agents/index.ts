// @agentsy/plugins/agents — Agent-to-Agent protocol and local sub-agent coordination
// Consolidated from @agentsy/agents for A2A protocol support

// Backward-compatible AgentManifest exports
export type { AgentsScaffoldStatus } from './builtins.js';
// Built-in definitions (new schema)
export {
  agentManifest,
  BUILTIN_AGENT_DEFINITIONS,
  BUILTIN_AGENT_MANIFESTS,
  codeAgentDefinition,
  defaultAgentDefinition,
  planAgentManifest,
  plannerAgentDefinition,
  researchAgentDefinition,
  researchAgentManifest
} from './builtins.js';
// New AgentDefinition schema
export type {
  AgentDefinition,
  AgentDefinitionSource,
  AgentMemoryScope,
  AgentOrchestrationMode
} from './definition.js';
// Agent loader and registry
export { AgentLoader } from './loader.js';
export { AgentRegistry } from './registry.js';
