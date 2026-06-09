// Core exports (consolidated from @agentsy/agents)
// Agent-to-Agent protocol and sub-agent coordination
export type * from './agents/index.js';
export * from './agents/index.js';
// Plugin audit: context injection auditor
export type * from './audit/context-injections.js';
export * from './audit/context-injections.js';
export {
  listManifestCapabilities,
  manifestExposesDiagnostics,
  manifestSupportsHostTarget
} from './manifest/capabilities.js';
export { createAgentManifestRegistry } from './manifest/registry.js';
// Plugin manifest types and registry
export type * from './manifest/types.js';
// Plugin sandbox for secure code execution
export type * from './sandbox/index.js';
export * from './sandbox/index.js';
// Plugin security: context-injection allowlist
export type * from './security/allowed-context-fields.js';
export * from './security/allowed-context-fields.js';
export * from './slash/index.js';
