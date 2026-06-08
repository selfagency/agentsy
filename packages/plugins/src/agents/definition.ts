/**
 * Agent definition types for the superagents plugin contract.
 *
 * Represents a fully-resolved agent configuration that can be loaded
 * from filesystem AGENT.md frontmatter or from built-in definitions.
 *
 * @module @agentsy/plugins/agents
 */

/** Orchestration strategy for the agent runtime. */
export type AgentOrchestrationMode = 'single' | 'orchestrated' | 'autonomous';

/** Memory persistence scope for the agent. */
export type AgentMemoryScope = 'session' | 'workspace' | 'user';

/** Origin of the agent definition. */
export type AgentDefinitionSource = 'bundled' | 'user' | 'workspace';

/**
 * Canonical agent definition.
 *
 * Describes an agent's identity, capabilities, and runtime configuration.
 * Loadable from AGENT.md frontmatter or provided as a built-in.
 */
export interface AgentDefinition {
  /** Allowed tool identifiers or '*' for unrestricted access. */
  allowedTools?: string[] | '*';

  /** Preferred model identifier. */
  defaultModel?: string;

  /** Short description of what the agent does. */
  description: string;

  /** Named hook references keyed by lifecycle event. */
  hooks?: Record<string, string>;
  /** Unique identifier (e.g. 'research', 'plan', 'code'). */
  id: string;

  /** Memory scopes the agent is permitted to access. */
  memoryScopes?: AgentMemoryScope[];

  /** Human-readable display name. */
  name: string;

  /** Orchestration strategy. Defaults to 'single'. */
  orchestrationMode?: AgentOrchestrationMode;

  /** Where this definition originated. */
  source: AgentDefinitionSource;

  /** Optional system prompt template with {{variables}}. */
  systemPromptTemplate?: string;
}
