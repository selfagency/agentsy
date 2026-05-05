import type { ThinkingTagPair } from '@agentsy/thinking';
import type { XmlToolCall } from '@agentsy/tool-calls';
import type { ConversationEvent, FinishReason, ToolCallState, UsageInfo } from '@agentsy/types';
import type { ToolCallParser } from './ToolCallParser.js';

/** Configuration options for `LLMStreamProcessor`. */
export interface ProcessorOptions {
  parseThinkTags?: boolean;
  scrubContextTags?: boolean;
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
  enforcePrivacyTags?: boolean;
  knownTools?: Set<string>;
  /**
   * When `true` (the default), `nativeToolCallDeltas` from each `StreamChunk` are accumulated
   * into complete tool calls via `ToolCallAccumulator` and emitted as `tool_call` events either
   * when processing a chunk with `done: true` or on an explicit `flush()` call.
   * Set to `false` to disable this behaviour and handle native deltas yourself.
   */
  accumulateNativeToolCalls?: boolean;
  modelId?: string;
  thinkingOpenTag?: string;
  thinkingCloseTag?: string;
  thinkingTagMap?: Map<string, ThinkingTagPair>;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
  /**
   * Maximum byte length of the `content` or `thinking` field in a single chunk.
   * Chunks exceeding this limit are truncated and a warning is emitted.
   * Applies per-chunk, not to the total accumulated message length.
   * Default: 262,144 (256 KiB). Set to `0` to disable.
   */
  maxInputLength?: number;
  /**
   * Maximum number of tool calls allowed per streamed message.
   * The limit is enforced cumulatively across all chunks in a single stream —
   * once the total accumulated tool call count reaches this value, further
   * calls in subsequent chunks are dropped and a warning is emitted.
   * Default: 64. Set to `0` to disable.
   */
  maxToolCallsPerMessage?: number;
  /**
   * Maximum serialised byte size of a single tool call's arguments object.
   * Tool calls whose JSON-serialised arguments exceed this limit are dropped
   * and a warning is emitted.
   * Default: 131,072 (128 KiB). Set to `0` to disable.
   */
  maxToolArgumentBytes?: number;
  /**
   * Maximum XML nesting depth the XML stream filter will process.
   * Content nested beyond this depth is silently discarded and a warning is
   * emitted, guarding against deeply-nested or adversarial XML payloads.
   * Default: 64. Set to `0` to disable.
   */
  maxXmlNestingDepth?: number;
  /**
   * Maximum byte length of residual buffers (_rawResidual and _filteredResidual combined).
   * When the total residual buffer size exceeds this limit, further appends are dropped
   * and a warning is emitted, preventing unbounded memory growth from streaming.
   * Default: 1,048,576 (1 MiB). Set to `0` to disable.
   */
  maxResidualBytes?: number;
  /** Maximum number of warnings emitted per processor lifetime. Default: 100. Set to 0 to disable. */
  maxWarnings?: number;
  /** Optional parser chain for provider-specific inline tool-call token formats. */
  toolCallParsers?: ToolCallParser[];
  /**
   * Optional chain of `TransformStream<OutputPart, OutputPart>` transforms applied to
   * `processor.partsStream`. Each transform receives the output of the previous one.
   * Does not affect the synchronous `process()` / `flush()` API.
   */
  transforms?: TransformStream<OutputPart, OutputPart>[];
}

/** A discriminated-union part of a `ProcessedOutput`, enabling structured iteration over output. */
export type OutputPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: XmlToolCall; state: ToolCallState }
  | { type: 'tool_call_delta'; id?: string; name: string; argumentsDelta: string; index: number };

/** Category of an incompleteness condition detected at stream end. */
export type IncompletenessType = 'thinking' | 'xml' | 'tool_calls';

/** Describes a single incompleteness condition found after stream flush. */
export interface IncompletenessDetail {
  type: IncompletenessType;
  reason: string;
}

/** The fully-processed result of one stream chunk or a final flush. */
export interface ProcessedOutput {
  thinking: string;
  content: string;
  /** Step index associated with this output, when supplied by the caller. */
  stepIndex?: number;
  /** Step-local usage associated with this output, when supplied by the caller. */
  stepUsage?: UsageInfo;
  /** Why the stream ended; `undefined` while the stream is still in progress. */
  finishReason?: FinishReason;
  toolCalls: XmlToolCall[];
  done: boolean;
  parts: OutputPart[];
  /** Accumulated token usage, populated from the last chunk that carried usage data. */
  usage?: UsageInfo;
  /** Whether any incomplete content was detected at flush time. */
  incomplete: boolean;
  /** Details of incomplete sections, if any. */
  incompleteness: IncompletenessDetail[];
}

export type StreamEventMap = {
  text: (delta: string) => void;
  thinking: (delta: string) => void;
  tool_call: (call: XmlToolCall) => void;
  tool_call_part: (part: Extract<OutputPart, { type: 'tool_call' }>) => void;
  /** Emitted for each streaming argument delta while a native tool call is assembling. */
  tool_call_delta: (delta: Extract<OutputPart, { type: 'tool_call_delta' }>) => void;
  /** Emits reducer-friendly conversation events derived from processor output. */
  conversation_event: (event: ConversationEvent) => void;
  done: () => void;
  warning: (message: string, context?: Record<string, unknown>) => void;
  /** Emitted each time a chunk carrying `usage` data is processed. */
  usage: (usage: UsageInfo) => void;
};
