import type { FinishReason } from '../tool-calls/types.js';
import type { ProcessedOutput } from '../processor/LLMStreamProcessor.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import type { UsageInfo } from '../normalizers/types.js';
import type { OutputPart } from '../processor/LLMStreamProcessor.js';
import type { StreamChunk } from '../processor/LLMStreamProcessor.js';

export type { FinishReason, OutputPart, StreamChunk };

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
  /** Hard cap on loop iterations. Defaults to 20. */
  maxSteps?: number;
  /** Caller-supplied function that transforms completed tool calls into messages to append. */
  buildToolResultMessages: (toolCalls: XmlToolCall[]) => Promise<unknown[]>;
}

export interface AgentLoopHandle {
  /** Async generator that yields OutputParts across all steps until the loop terminates. */
  run: (initialMessages: unknown[]) => AsyncGenerator<OutputPart>;
  /** Abort the running loop. No further parts are emitted after abort is called. */
  abort: () => void;
}
