import type { UsageInfo } from '../normalizers/types.js';
import type { ProcessedOutput, StreamChunk, OutputPart } from '../processor/LLMStreamProcessor.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import type { FinishReason } from '../tool-calls/types.js';
import type { AgUiEvent } from '../ag-ui/types.js';
import type { InterruptController } from '../ag-ui/interrupt-handler.js';

export type { ProcessedOutput } from '../processor/LLMStreamProcessor.js';
export type { FinishReason } from '../tool-calls/types.js';
export type { OutputPart, StreamChunk } from '../processor/LLMStreamProcessor.js';

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

export interface AgentLoopOptions {
  /** Caller-supplied LLM invocation. Receives current message history, returns a stream of chunks. */
  execute: (messages: unknown[]) => AsyncIterable<StreamChunk>;
  /** Stop condition(s) evaluated after every step. Loop continues only when ALL conditions return false. */
  stopWhen: StopCondition | StopCondition[];
  /** Optional callback fired after each completed step. */
  onStep?: (result: StepResult) => void | Promise<void>;
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
