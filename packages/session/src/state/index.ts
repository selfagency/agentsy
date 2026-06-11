/**
 * Typed session state with Zod schemas and immutable reducers.
 *
 * @module
 */

export {
  BranchMetaSchema,
  CheckpointSchema,
  ContentPartSchema,
  ImagePartSchema,
  MessageSchema,
  SessionStateSchema,
  TextPartSchema,
  ToolCallPartSchema,
  ToolCallSchema,
  ToolCallStateSchema,
  ToolResultPartSchema,
  createSessionState
} from './schema.js';

export type {
  BranchMeta,
  Checkpoint,
  ContentPart,
  ImagePart,
  Message,
  SessionState,
  TextPart,
  ToolCall,
  ToolCallState,
  ToolResultPart
} from './schema.js';

export { reduceSessionState } from './reducers.js';

export type {
  AddCheckpointAction,
  AddToolCallAction,
  AppendMessageAction,
  ForkSessionAction,
  PinMessageAction,
  ReducerAction,
  ReplaceMessagesAction,
  SetMetaAction,
  TruncateMessagesAction,
  UnpinMessageAction,
  UpdateMessageAction,
  UpdateTimestampsAction,
  UpdateToolCallAction
} from './reducers.js';
