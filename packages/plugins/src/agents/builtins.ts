import type { AgentManifest } from '../manifest/types.js';

/**
 * @deprecated Scaffold status type — retained for backwards compatibility.
 * Use the manifest types and registry for new code.
 */
export type AgentsScaffoldStatus = 'pending-implementation';

/**
 * Built-in research agent manifest.
 *
 * Systematic research agent for gathering and synthesizing information.
 * Operates with session-scoped memory and broad information-gathering tool access.
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
 * Built-in plan agent manifest.
 *
 * Strategic planning agent for architecture and implementation design.
 * Operates with project-scoped memory and analysis-oriented tools.
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
 * Built-in general-purpose agent manifest.
 *
 * Autonomous agent for multi-step execution with investigate/review/test discipline.
 * Has broad tool access and operates with session-scoped memory.
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
 * Array of all built-in agent manifests.
 */
export const BUILTIN_AGENT_MANIFESTS: AgentManifest[] = [researchAgentManifest, planAgentManifest, agentManifest];
