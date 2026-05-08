import { z } from 'zod';

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  capabilities: z.array(z.string()),
});

export type Skill = z.infer<typeof SkillSchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['compute', 'memory', 'storage', 'network']),
  amount: z.number(),
  unit: z.string(),
});

export type Resource = z.infer<typeof ResourceSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  requirements: z.array(SkillSchema),
  resources: z.array(ResourceSchema),
  input: z.record(z.unknown()),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  timeout: z.number().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const AgentCapabilitiesSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(SkillSchema),
  maxConcurrency: z.number(),
  costPerTask: z.number(),
  available: z.boolean(),
  lastSeen: z.date(),
});

export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

export const WorkflowSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  requirements: z.object({
    skills: z.array(SkillSchema),
    resources: z.array(ResourceSchema),
    constraints: z.array(z.string()),
    dependencies: z.array(z.string()),
  }),
  nodes: z.array(z.unknown()), // Will be refined with specific node types
  events: z.object({
    triggers: z.array(z.unknown()),
    handlers: z.array(z.unknown()),
    filters: z.array(z.unknown()),
  }),
  timing: z.object({
    timeout: z.number(),
    retries: z.number(),
    scheduling: z.string(),
    priorities: z.record(z.number()),
  }),
});

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

import { WorkflowStatus as WorkflowStatusEnum } from './workflow.js';

export const WorkflowResultSchema = z.object({
  workflowId: z.string(),
  status: z.nativeEnum(WorkflowStatusEnum),
  results: z.record(z.unknown()),
  errors: z.array(z.string()),
  metrics: z.object({
    duration: z.number(),
    cost: z.number(),
    agentsUsed: z.number(),
  }),
});

export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;
