import { z } from 'zod';
import { NodeType, WorkflowStatus as WorkflowStatusEnum } from './workflow.js';

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  capabilities: z.array(z.string())
});

export type Skill = z.infer<typeof SkillSchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['compute', 'memory', 'storage', 'network']),
  amount: z.number(),
  unit: z.string()
});

export type Resource = z.infer<typeof ResourceSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  requirements: z.array(SkillSchema),
  resources: z.array(ResourceSchema),
  input: z.record(z.string(), z.unknown()),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  timeout: z.number().optional()
});

export type Task = z.infer<typeof TaskSchema>;

export const AgentCapabilitiesSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(SkillSchema),
  maxConcurrency: z.number(),
  costPerTask: z.number(),
  available: z.boolean(),
  lastSeen: z.date()
});

export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

const RetryPolicySchema = z.object({
  maxAttempts: z.number(),
  backoffStrategy: z.enum(['linear', 'exponential', 'fixed']),
  baseDelay: z.number(),
  maxDelay: z.number()
});

const TaskNodeSchema = z.object({
  type: z.literal(NodeType.TASK),
  id: z.string(),
  name: z.string(),
  agent: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  timeout: z.number().optional(),
  retryPolicy: RetryPolicySchema.optional()
});

const DecisionNodeSchema = z.object({
  type: z.literal(NodeType.DECISION),
  id: z.string(),
  name: z.string(),
  condition: z.string(),
  trueBranch: z.array(z.string()),
  falseBranch: z.array(z.string())
});

const ParallelNodeSchema = z.object({
  type: z.literal(NodeType.PARALLEL),
  id: z.string(),
  name: z.string(),
  branches: z.array(z.string()),
  maxConcurrency: z.number().optional(),
  failFast: z.boolean().optional()
});

const SequenceNodeSchema = z.object({
  type: z.literal(NodeType.SEQUENCE),
  id: z.string(),
  name: z.string(),
  steps: z.array(z.string()),
  continueOnError: z.boolean().optional()
});

const MergeNodeSchema = z.object({
  type: z.literal(NodeType.MERGE),
  id: z.string(),
  name: z.string(),
  inputs: z.array(z.string()),
  strategy: z.enum(['join', 'first', 'all', 'majority'])
});

const WorkflowNodeSchema = z.discriminatedUnion('type', [
  TaskNodeSchema,
  DecisionNodeSchema,
  ParallelNodeSchema,
  SequenceNodeSchema,
  MergeNodeSchema
]);

export const WorkflowSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  requirements: z.object({
    skills: z.array(SkillSchema),
    resources: z.array(ResourceSchema),
    constraints: z.array(z.string()),
    dependencies: z.array(z.string())
  }),
  nodes: z.array(WorkflowNodeSchema),
  events: z.object({
    triggers: z.array(z.unknown()),
    handlers: z.array(z.unknown()),
    filters: z.array(z.unknown())
  }),
  timing: z.object({
    timeout: z.number(),
    retries: z.number(),
    scheduling: z.string(),
    priorities: z.record(z.string(), z.number())
  })
});

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

export const WorkflowResultSchema = z.object({
  workflowId: z.string(),
  status: z.nativeEnum(WorkflowStatusEnum),
  results: z.record(z.string(), z.unknown()),
  errors: z.array(z.string()),
  metrics: z.object({
    duration: z.number(),
    cost: z.number(),
    agentsUsed: z.number()
  })
});

export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;
