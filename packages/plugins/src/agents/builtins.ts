import type { AgentManifest } from '../manifest/types.js';
import type { AgentDefinition } from './definition.js';

// ──────────────────────────────────────────────
// AgentDefinition builtins (new schema)
// ──────────────────────────────────────────────

/**
 * Built-in default/general-purpose agent definition.
 *
 * General-purpose multi-mode agent with unrestricted tool access.
 */
export const defaultAgentDefinition: AgentDefinition = {
  id: 'default',
  name: 'Default Agent',
  description: 'General-purpose multi-mode agent with unrestricted tool access.',
  allowedTools: '*',
  orchestrationMode: 'single',
  source: 'bundled'
};

/**
 * Built-in research agent definition.
 *
 * Iterative search and synthesis agent for information-gathering tasks.
 */
export const researchAgentDefinition: AgentDefinition = {
  id: 'research',
  name: 'Research Agent',
  description: 'Iterative search and synthesis for information gathering and analysis.',
  systemPromptTemplate:
    'You are a thorough research assistant. Gather information systematically, evaluate source credibility, synthesize findings across sources, and present conclusions with proper citations. Prioritize accuracy and depth over speed.',
  allowedTools: ['web-search', 'web-fetch', 'code-search', 'document-analysis', 'arxiv'],
  memoryScopes: ['session'],
  orchestrationMode: 'orchestrated',
  defaultModel: 'claude-sonnet-4-20250514',
  source: 'bundled'
};

/**
 * Built-in code agent definition.
 *
 * Structured code development agent with code execution and filesystem access.
 */
export const codeAgentDefinition: AgentDefinition = {
  id: 'code',
  name: 'Code Agent',
  description: 'Structured code development with execution and filesystem tooling.',
  systemPromptTemplate:
    'You are a capable autonomous engineer. Break down complex tasks, investigate systematically, verify your work, and iterate until complete. Follow the discipline: investigate first, implement second, review third, test fourth.',
  allowedTools: [
    'code-search',
    'web-fetch',
    'file-read',
    'file-write',
    'code-execution',
    'shell-command',
    'git-operations',
    'package-management'
  ],
  memoryScopes: ['session'],
  orchestrationMode: 'orchestrated',
  defaultModel: 'claude-sonnet-4-20250514',
  source: 'bundled'
};

/**
 * Built-in planner agent definition.
 *
 * Interview-driven planning and architecture design agent.
 */
export const plannerAgentDefinition: AgentDefinition = {
  id: 'plan',
  name: 'Planner Agent',
  description: 'Interview-driven planning and architecture design with memory append.',
  systemPromptTemplate:
    'You are a senior technical architect. Design clear, actionable plans with explicit trade-offs, risk assessment, and incremental delivery steps. Ask clarifying questions when requirements are ambiguous. Produce structured output with rationale for each decision.',
  allowedTools: ['code-search', 'web-fetch', 'file-read', 'architecture-analysis', 'memory-append'],
  memoryScopes: ['workspace'],
  orchestrationMode: 'single',
  defaultModel: 'claude-opus-4-20250514',
  source: 'bundled'
};

/**
 * Array of all built-in agent definitions (new schema).
 */
export const BUILTIN_AGENT_DEFINITIONS: AgentDefinition[] = [
  defaultAgentDefinition,
  researchAgentDefinition,
  codeAgentDefinition,
  plannerAgentDefinition
];

// ──────────────────────────────────────────────
// Backward-compatible AgentManifest exports
// ──────────────────────────────────────────────

/**
 * @deprecated Scaffold status type — retained for backwards compatibility.
 * Use the manifest types and registry for new code.
 */
export type AgentsScaffoldStatus = 'pending-implementation';

/**
 * @deprecated Use {@link researchAgentDefinition} instead.
 *
 * Built-in research agent manifest.
 */
export const researchAgentManifest: AgentManifest = {
  id: 'superagents/research',
  name: 'Research Agent',
  mode: 'research',
  description:
    'Systematic research agent for gathering, analyzing, and synthesizing information from multiple sources with citations.',
  systemPrompt:
    'You are a thorough research assistant. Gather information systematically, evaluate source credibility, synthesize findings across sources, and present conclusions with proper citations. Prioritize accuracy and depth over speed.',
  defaultModel: 'claude-sonnet-4-20250514',
  allowedTools: ['web-search', 'web-fetch', 'code-search', 'document-analysis', 'arxiv'],
  memoryScope: 'session',
  requiresApproval: false
};

/**
 * @deprecated Use {@link plannerAgentDefinition} instead.
 *
 * Built-in plan agent manifest.
 */
export const planAgentManifest: AgentManifest = {
  id: 'superagents/plan',
  name: 'Plan Agent',
  mode: 'plan',
  description:
    'Strategic planning agent for architecture design, implementation planning, and structured solution design.',
  systemPrompt:
    'You are a senior technical architect. Design clear, actionable plans with explicit trade-offs, risk assessment, and incremental delivery steps. Ask clarifying questions when requirements are ambiguous. Produce structured output with rationale for each decision.',
  defaultModel: 'claude-opus-4-20250514',
  allowedTools: ['code-search', 'web-fetch', 'file-read', 'architecture-analysis'],
  memoryScope: 'project',
  requiresApproval: false
};

/**
 * @deprecated Use {@link defaultAgentDefinition} or {@link codeAgentDefinition} instead.
 *
 * Built-in general-purpose agent manifest.
 */
export const agentManifest: AgentManifest = {
  id: 'superagents/agent',
  name: 'Super Agent',
  mode: 'agent',
  description:
    'General-purpose autonomous agent for multi-step execution with investigate, review, and test discipline.',
  systemPrompt:
    'You are a capable autonomous engineer. Break down complex tasks, investigate systematically, verify your work, and iterate until complete. Follow the discipline: investigate first, implement second, review third, test fourth. Ask for clarification when blocked.',
  defaultModel: 'claude-sonnet-4-20250514',
  allowedTools: [
    'code-search',
    'web-fetch',
    'file-read',
    'file-write',
    'code-execution',
    'shell-command',
    'git-operations',
    'package-management'
  ],
  memoryScope: 'session',
  requiresApproval: true
};

/**
 * @deprecated Use {@link BUILTIN_AGENT_DEFINITIONS} instead.
 *
 * Array of all built-in agent manifests.
 */
export const BUILTIN_AGENT_MANIFESTS: AgentManifest[] = [researchAgentManifest, planAgentManifest, agentManifest];
