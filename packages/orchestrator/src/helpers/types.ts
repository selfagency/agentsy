export type HelperTrigger = 'manual' | 'background' | 'on-failure' | 'on-threshold';
export type HelperVisibility = 'internal' | 'user-visible';

export interface HelperRoleDefinition {
  capabilities: string[];
  description: string;
  id: string;
  maxConcurrency?: number;
  name: string;
  trigger: HelperTrigger;
  visibility: HelperVisibility;
}

export interface HelperPolicyInput {
  activeCount?: number;
  enabled?: boolean;
  helper: HelperRoleDefinition;
}

export interface HelperPolicyDecision {
  allowed: boolean;
  reason?: string;
}
