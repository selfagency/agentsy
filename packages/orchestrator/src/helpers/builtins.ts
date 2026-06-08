import type { HelperRoleDefinition } from './types.js';

export const BUILTIN_HELPER_ROLES: HelperRoleDefinition[] = [
  {
    id: 'planner',
    name: 'Planner',
    description: 'Decomposes work and proposes execution steps.',
    capabilities: ['planning', 'decomposition'],
    trigger: 'manual',
    visibility: 'user-visible',
    maxConcurrency: 1
  },
  {
    id: 'critic',
    name: 'Critic',
    description: 'Reviews intermediate outputs for risk or inconsistency.',
    capabilities: ['review', 'risk-analysis'],
    trigger: 'on-threshold',
    visibility: 'internal',
    maxConcurrency: 1
  },
  {
    id: 'repairer',
    name: 'Repairer',
    description: 'Attempts targeted recovery after failures.',
    capabilities: ['repair', 'recovery'],
    trigger: 'on-failure',
    visibility: 'internal',
    maxConcurrency: 1
  }
];
