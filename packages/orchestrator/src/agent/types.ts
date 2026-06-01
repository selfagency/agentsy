import type { OutputPart, ProcessedOutput, StreamChunk } from '@agentsy/core/processor';
import type { XmlToolCall } from '@agentsy/core/tool-calls';
import type { AgUiEvent, InterruptController } from '@agentsy/runtime/ag-ui';
import type { FinishReason, UsageInfo } from '@agentsy/types';

export type { OutputPart, ProcessedOutput, StreamChunk } from '@agentsy/core/processor';
export type { FinishReason } from '@agentsy/types';

export type StopCondition = (state: AgentLoopState) => boolean;

export interface StepResult {
  output: ProcessedOutput;
  toolCalls: XmlToolCall[];
  finishReason: FinishReason | undefined;
  usage: UsageInfo | undefined;
}

export interface AgentLoopState {
  steps: StepResult[];
  stepIndex: number;
  lastOutput: ProcessedOutput;
  toolCallCount: number;
  consecutiveIdenticalCalls: number;
}

export interface AgentLoopContext {
  runId: string;
  threadId?: string;
  stepIndex: number;
  messages: unknown[];
  state: AgentLoopState;
  signal: AbortSignal;
}

export interface AgentLoopStepContext extends AgentLoopContext {
  stepResult: StepResult;
}

export interface AgentLoopToolContext extends AgentLoopStepContext {
  toolCalls: XmlToolCall[];
  approvedToolCalls?: XmlToolCall[];
  deniedToolCalls?: XmlToolCall[];
  toolApprovalMode?: ToolApprovalMode;
  toolResultMessages?: unknown[];
}

export type AgentLoopAbortReason = 'abort' | 'interrupt';
export type ToolApprovalMode = 'allow' | 'ask' | 'deny' | 'auto';
export type ToolApprovalDecision = 'allow' | 'deny';

export interface ToolApprovalContext extends AgentLoopToolContext {
  mode: ToolApprovalMode;
}

export interface ToolApprovalResult {
  decision?: ToolApprovalDecision;
  approvedToolCalls?: XmlToolCall[];
  deniedToolCalls?: XmlToolCall[];
  reason?: string;
}

export type AgentLoopOutcome = 'success' | 'interrupt' | 'error' | 'abort';

export interface AgentLoopFinalContext extends AgentLoopContext {
  outcome: AgentLoopOutcome;
  finalOutput: ProcessedOutput;
}

export interface AgentLoopStepOverrides {
  messages?: unknown[];
  stopWhen?: StopCondition | StopCondition[];
  maxConversationMessages?: number;
  toolApprovalMode?: ToolApprovalMode;
  buildToolResultMessages?: AgentLoopOptions['buildToolResultMessages'];
  approveToolCalls?: AgentLoopOptions['approveToolCalls'];
  beforeStep?: AgentLoopOptions['beforeStep'];
  onStep?: AgentLoopOptions['onStep'];
  afterStep?: AgentLoopOptions['afterStep'];
  beforeToolCall?: AgentLoopOptions['beforeToolCall'];
  afterToolCall?: AgentLoopOptions['afterToolCall'];
  onAbort?: AgentLoopOptions['onAbort'];
  onError?: AgentLoopOptions['onError'];
  beforeFinal?: AgentLoopOptions['beforeFinal'];
  afterFinal?: AgentLoopOptions['afterFinal'];
}

export interface AgentLoopOptions {
  /** Caller-supplied LLM invocation. Receives current message history, returns a stream of chunks. */
  execute: (messages: unknown[]) => AsyncIterable<StreamChunk>;
  /** Stop condition(s) evaluated after every step. Loop continues only when ALL conditions return false. */
  stopWhen: StopCondition | StopCondition[];
  /** Optional hook fired after loop state is initialized but before RUN_STARTED is emitted. */
  beforeInit?: (context: AgentLoopContext) => void | Promise<void>;
  /** Optional hook fired after RUN_STARTED is emitted. */
  afterInit?: (context: AgentLoopContext) => void | Promise<void>;
  /** Optional hook fired immediately before each loop step executes. */
  beforeStep?: (context: AgentLoopContext) => void | Promise<void>;
  /** Optional hook for per-step message/callback/tool configuration overrides. */
  prepareStep?: (
    context: AgentLoopContext
  ) => AgentLoopStepOverrides | undefined | Promise<AgentLoopStepOverrides | undefined>;
  /** Optional callback fired after each completed step. */
  onStep?: (result: StepResult) => void | Promise<void>;
  /** Optional hook fired after state has been updated for a completed step. */
  afterStep?: (context: AgentLoopStepContext) => void | Promise<void>;
  /** Optional hook fired before transforming tool calls into tool result messages. */
  beforeToolCall?: (context: AgentLoopToolContext) => void | Promise<void>;
  /** Optional hook fired after tool result messages have been built. */
  afterToolCall?: (context: AgentLoopToolContext) => void | Promise<void>;
  /** Tool approval mode. Defaults to `allow`. `ask` requires `approveToolCalls` to continue. */
  toolApprovalMode?: ToolApprovalMode;
  /** Optional tool approval callback used by `ask` and `auto` modes. */
  approveToolCalls?: (
    context: ToolApprovalContext
  ) =>
    | boolean
    | ToolApprovalDecision
    | ToolApprovalResult
    | Promise<boolean | ToolApprovalDecision | ToolApprovalResult>;
  /** Optional callback fired when the loop aborts via explicit abort() or interrupt controller. */
  onAbort?: (reason: AgentLoopAbortReason, context: AgentLoopContext) => void | Promise<void>;
  /** Optional callback fired when execute/process logic throws. */
  onError?: (error: Error, context: AgentLoopContext) => void | Promise<void>;
  /** Optional hook fired before terminal run events are emitted/returned. */
  beforeFinal?: (context: AgentLoopFinalContext) => void | Promise<void>;
  /** Optional hook fired after terminal run events are emitted. */
  afterFinal?: (context: AgentLoopFinalContext) => void | Promise<void>;
  /** Optional callback fired for AG-UI protocol events (RUN_STARTED, STEP_STARTED, etc). */
  onAgUiEvent?: (event: AgUiEvent) => void | Promise<void>;
  /** Unique identifier for this run (e.g., UUID). Used for AG-UI events. */
  runId?: string;
  /** Thread ID for this conversation (optional). Passed through AG-UI events. */
  threadId?: string;
  /** Optional interrupt controller for cancelling execution. */
  interruptController?: InterruptController;
  /** Hard cap on loop iterations. Defaults to 20. */
  maxSteps?: number;
  /** Maximum conversation messages to retain. Older messages are trimmed. Defaults to unlimited. */
  maxConversationMessages?: number;
  /** Caller-supplied function that transforms completed tool calls into messages to append. */
  buildToolResultMessages: (toolCalls: XmlToolCall[]) => Promise<unknown[]>;
}

export interface AgentLoopHandle {
  /** Async generator that yields OutputParts across all steps until the loop terminates. */
  run: (initialMessages: unknown[]) => AsyncGenerator<OutputPart>;
  /** Abort the running loop. No further parts are emitted after abort is called. */
  abort: () => void;
}
