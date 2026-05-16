import { z } from "zod";

import { NodeType, WorkflowStatus as WorkflowStatusEnum } from "./workflow.js";

export const SkillSchema = z.object({
  capabilities: z.array(z.string()),
  category: z.string(),
  id: z.string(),
  name: z.string(),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
});

export type Skill = z.infer<typeof SkillSchema>;

export const ResourceSchema = z.object({
  amount: z.number(),
  id: z.string(),
  name: z.string(),
  type: z.enum(["compute", "memory", "storage", "network"]),
  unit: z.string(),
});

export type Resource = z.infer<typeof ResourceSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  input: z.record(z.string(), z.unknown()),
  name: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  requirements: z.array(SkillSchema),
  resources: z.array(ResourceSchema),
  timeout: z.number().optional(),
  type: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

export const AgentCapabilitiesSchema = z.object({
  available: z.boolean(),
  costPerTask: z.number(),
  id: z.string(),
  lastSeen: z.date(),
  maxConcurrency: z.number(),
  name: z.string(),
  skills: z.array(SkillSchema),
});

export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

const RetryPolicySchema = z.object({
  backoffStrategy: z.enum(["linear", "exponential", "fixed"]),
  baseDelay: z.number(),
  maxAttempts: z.number(),
  maxDelay: z.number(),
});

const TaskNodeSchema = z.object({
  agent: z.string(),
  id: z.string(),
  input: z.record(z.string(), z.unknown()),
  name: z.string(),
  output: z.record(z.string(), z.unknown()),
  retryPolicy: RetryPolicySchema.optional(),
  timeout: z.number().optional(),
  type: z.literal(NodeType.TASK),
});

const DecisionNodeSchema = z.object({
  condition: z.string(),
  falseBranch: z.array(z.string()),
  id: z.string(),
  name: z.string(),
  trueBranch: z.array(z.string()),
  type: z.literal(NodeType.DECISION),
});

const ParallelNodeSchema = z.object({
  branches: z.array(z.string()),
  failFast: z.boolean().optional(),
  id: z.string(),
  maxConcurrency: z.number().optional(),
  name: z.string(),
  type: z.literal(NodeType.PARALLEL),
});

const SequenceNodeSchema = z.object({
  continueOnError: z.boolean().optional(),
  id: z.string(),
  name: z.string(),
  steps: z.array(z.string()),
  type: z.literal(NodeType.SEQUENCE),
});

const MergeNodeSchema = z.object({
  id: z.string(),
  inputs: z.array(z.string()),
  name: z.string(),
  strategy: z.enum(["join", "first", "all", "majority"]),
  type: z.literal(NodeType.MERGE),
});

const WorkflowNodeSchema = z.discriminatedUnion("type", [
  TaskNodeSchema,
  DecisionNodeSchema,
  ParallelNodeSchema,
  SequenceNodeSchema,
  MergeNodeSchema,
]);

export const WorkflowSpecSchema = z.object({
  description: z.string(),
  events: z.object({
    filters: z.array(z.unknown()),
    handlers: z.array(z.unknown()),
    triggers: z.array(z.unknown()),
  }),
  id: z.string(),
  name: z.string(),
  nodes: z.array(WorkflowNodeSchema),
  requirements: z.object({
    constraints: z.array(z.string()),
    dependencies: z.array(z.string()),
    resources: z.array(ResourceSchema),
    skills: z.array(SkillSchema),
  }),
  timing: z.object({
    priorities: z.record(z.string(), z.number()),
    retries: z.number(),
    scheduling: z.string(),
    timeout: z.number(),
  }),
  version: z.string(),
});

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

export const WorkflowResultSchema = z.object({
  errors: z.array(z.string()),
  metrics: z.object({
    agentsUsed: z.number(),
    cost: z.number(),
    duration: z.number(),
  }),
  results: z.record(z.string(), z.unknown()),
  status: z.nativeEnum(WorkflowStatusEnum),
  workflowId: z.string(),
});

export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;
