/**
 * Typed state schema for session durability.
 *
 * Provides Zod-based validation for session snapshots, messages, tool calls,
 * and checkpoints so the runtime can deterministically serialize, restore,
 * and fork session state.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Content parts (mirrors @agentsy/types ContentPart)
// ---------------------------------------------------------------------------

/** Text content part. */
export const TextPartSchema = z.object({
  text: z.string(),
  type: z.literal('text')
});

/** Image content part (for multimodal models). */
export const ImagePartSchema = z.object({
  detail: z.enum(['auto', 'low', 'high']).optional(),
  imageUrl: z.string(),
  type: z.literal('image')
});

/** Tool call content part. */
export const ToolCallPartSchema = z.object({
  id: z.string(),
  input: z.record(z.unknown()),
  name: z.string(),
  type: z.literal('tool_call')
});

/** Tool result content part. */
export const ToolResultPartSchema = z.object({
  content: z.string(),
  toolCallId: z.string(),
  type: z.literal('tool_result')
});

export const ContentPartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  ImagePartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema
]);

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export const MessageSchema = z.object({
  content: z.union([z.string(), z.array(ContentPartSchema)]),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  toolCallId: z.string().optional(),
  toolName: z.string().optional()
});

// ---------------------------------------------------------------------------
// Tool call queue
// ---------------------------------------------------------------------------

export const ToolCallStateSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
  status: ToolCallStateSchema
});

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

export const CheckpointSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  createdAt: z.number(),
  messageCount: z.number(),
  toolCallCount: z.number(),
  threadId: z.string()
});

// ---------------------------------------------------------------------------
// Branching
// ---------------------------------------------------------------------------

export const BranchMetaSchema = z.object({
  parentSessionId: z.string(),
  parentThreadId: z.string(),
  forkedAt: z.number(),
  forkReason: z.string().optional()
});

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  threadId: z.string(),
  parentSessionId: z.string().optional(),
  parentThreadId: z.string().optional(),
  branchMeta: BranchMetaSchema.optional(),
  messages: z.array(MessageSchema),
  toolCallQueue: z.array(ToolCallSchema),
  checkpoints: z.array(CheckpointSchema),
  pinnedMessageIds: z.array(z.string()).optional(),
  meta: z.record(z.unknown()),
  createdAt: z.number(),
  updatedAt: z.number()
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TextPart = z.infer<typeof TextPartSchema>;
export type ImagePart = z.infer<typeof ImagePartSchema>;
export type ToolCallPart = z.infer<typeof ToolCallPartSchema>;
export type ToolResultPart = z.infer<typeof ToolResultPartSchema>;
export type ContentPart = z.infer<typeof ContentPartSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type BranchMeta = z.infer<typeof BranchMetaSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type ToolCallState = z.infer<typeof ToolCallStateSchema>;

/**
 * Creates a minimal valid session state with defaults.
 */
export function createSessionState(sessionId: string, threadId: string): SessionState {
  return SessionStateSchema.parse({
    sessionId,
    threadId,
    messages: [],
    toolCallQueue: [],
    checkpoints: [],
    meta: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}
