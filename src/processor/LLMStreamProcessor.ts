import type { NativeToolCallDelta, UsageInfo } from '../normalizers/types.js';
import type { FinishReason, ToolCallState } from '../tool-calls/types.js';
import { ThinkingParser, type ThinkingTagPair } from '../thinking/ThinkingParser.js';
import { ToolCallAccumulator } from '../tool-calls/ToolCallAccumulator.js';
import { extractXmlToolCalls, type XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import { createXmlStreamFilter, type XmlStreamFilter } from '../xml-filter/XmlStreamFilter.js';
import type { AccumulatedMessage } from './AccumulatedMessage.js';
import { createEmptyStats, type ProcessorStats } from './ProcessorStats.js';
import { detectIncompleteness } from './incompleteness.js';

/** A single chunk of output from a normalised LLM stream. */
export interface StreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
  done?: boolean;
  /** Token usage information, populated on the final chunk from the normalizer layer. */
  usage?: UsageInfo;
  /** Streaming deltas for native (non-XML) tool calls from providers that use JSON-format tool calls. */
  nativeToolCallDeltas?: NativeToolCallDelta[];
  /** Why the stream ended, populated on the final chunk. */
  finishReason?: FinishReason;
}

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
}

/** A discriminated-union part of a `ProcessedOutput`, enabling structured iteration over output. */
export type OutputPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: XmlToolCall; state: ToolCallState }
  | { type: 'tool_call_delta'; id: string; name: string; argumentsDelta: string; index: number };

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
  done: () => void;
  warning: (message: string, context?: Record<string, unknown>) => void;
  /** Emitted each time a chunk carrying `usage` data is processed. */
  usage: (usage: UsageInfo) => void;
};

const DEFAULT_MAX_INPUT_LENGTH = 256 * 1024;
const DEFAULT_MAX_TOOL_CALLS_PER_MESSAGE = 64;
const DEFAULT_MAX_TOOL_ARGUMENT_BYTES = 128 * 1024;
// biome-ignore lint/complexity/noUnusedVariables: Reserved for future XML nesting depth limits
const _DEFAULT_MAX_XML_NESTING_DEPTH = 64; // Reserved for future XML nesting depth limits
const DEFAULT_MAX_RESIDUAL_BYTES = 1024 * 1024; // 1 MiB
const DEFAULT_MAX_WARNINGS = 100;
const SHARED_TEXT_ENCODER = new TextEncoder();

/**
 * Processes a normalised LLM stream chunk-by-chunk, extracting thinking blocks,
 * filtering XML tags, accumulating tool calls, and emitting typed events.
 *
 * @example
 * ```ts
 * const processor = new LLMStreamProcessor({ parseThinkTags: true });
 *
 * for await (const chunk of normalizedStream) {
 *   const output = processor.process(chunk);
 *   if (output.content) process.stdout.write(output.content);
 * }
 *
 * const final = processor.flush();
 * if (final.incomplete) console.warn('Stream cut short', final.incompleteness);
 * ```
 */
export class LLMStreamProcessor {
  private readonly options: Required<Pick<ProcessorOptions, 'parseThinkTags' | 'scrubContextTags'>> & ProcessorOptions;
  private thinkingParser: ThinkingParser | null;
  private xmlFilter: XmlStreamFilter | null;
  private readonly nativeAccumulator: ToolCallAccumulator | null;

  private _accumulatedThinking = '';
  private _accumulatedContent = '';
  private _accumulatedToolCalls: XmlToolCall[] = [];
  private _accumulatedUsage: UsageInfo | undefined = undefined;
  private _lastFinishReason: FinishReason | undefined = undefined;
  private doneEmitted = false;
  private _warningCount = 0;
  private _stats: ProcessorStats;
  // Accumulate filtered XML fragments returned by the XmlStreamFilter so
  // that tool-call blocks spanning multiple chunks can be reconstructed and
  // extracted when they become complete.
  private _filteredResidual = '';
  // Accumulate raw (unfiltered) incoming content fragments to allow
  // reconstruction of tool_call blocks that were split across chunks
  // even when the xmlFilter will scrub those tags.
  private _rawResidual = '';

  private get usagePayload(): { usage: UsageInfo } | Record<string, never> {
    if (this._accumulatedUsage !== undefined) {
      return { usage: this._accumulatedUsage };
    }
    return {};
  }

  private readonly listeners: {
    [K in keyof StreamEventMap]: Set<StreamEventMap[K]>;
  } = {
    text: new Set(),
    thinking: new Set(),
    tool_call: new Set(),
    done: new Set(),
    warning: new Set(),
    usage: new Set(),
  };

  /** Creates a new processor instance. Reuse across a single conversation; call `reset()` between conversations. */
  public constructor(options: ProcessorOptions = {}) {
    this.options = {
      ...options,
      parseThinkTags: options.parseThinkTags ?? true,
      scrubContextTags: options.scrubContextTags ?? true,
    };

    this.thinkingParser = this.createThinkingParser();
    this.xmlFilter = this.createXmlFilter();
    this.nativeAccumulator = (options.accumulateNativeToolCalls ?? true) ? new ToolCallAccumulator() : null;
    this._stats = createEmptyStats();
  }

  /**
   * Processes a single stream chunk and returns the processed output delta.
   * May be called any number of times before `flush()`.
   */
  public process(chunk: StreamChunk): ProcessedOutput {
    const startTime = performance.now();
    const chunkSize = this.estimateChunkSize(chunk);

    this._stats.chunksProcessed++;
    this._stats.bytesProcessed += chunkSize;
    this._stats.firstChunkAt ??= new Date();
    this._stats.lastChunkAt = new Date();

    // Track if this chunk has content or thinking input
    const hasContentInput = typeof chunk.content === 'string' && chunk.content.length > 0;
    const hasThinkingInput = typeof chunk.thinking === 'string' && chunk.thinking.length > 0;

    const rawThinking = this.enforceMaxLength(this.ensureText(chunk.thinking), 'thinking');
    const rawContent = this.enforceMaxLength(this.ensureText(chunk.content), 'content');

    let thinking = rawThinking;
    let content = rawContent;

    if (this.thinkingParser && content) {
      const [thinkingDelta, contentDelta] = this.thinkingParser.addContent(content);
      thinking += thinkingDelta;
      content = contentDelta;
    }

    // First attempt extraction from the raw incoming content (captures the
    // common case where tool call tags are fully contained in the chunk).
    const extractedFromRaw =
      this.options.knownTools && rawContent ? extractXmlToolCalls(rawContent, this.options.knownTools) : [];

    // Also append raw content into a residual buffer and scan for completed
    // top-level tags that may span multiple chunks. This allows extracting
    // tool_call blocks even when they are split across chunks and when the
    // XML stream filter would otherwise scrub them.
    let extractedFromRawResidual: XmlToolCall[] = [];
    if (this.options.knownTools && rawContent) {
      // Security: Enforce maxResidualBytes limit to prevent unbounded memory growth
      const maxResidualBytes = this.options.maxResidualBytes ?? DEFAULT_MAX_RESIDUAL_BYTES;
      const newResidualSize = this._rawResidual.length + this._filteredResidual.length + rawContent.length;
      if (maxResidualBytes > 0 && newResidualSize > maxResidualBytes) {
        this.warn(`Residual buffer would exceed maxResidualBytes (${maxResidualBytes}), skipping raw content append`, {
          currentSize: this._rawResidual.length + this._filteredResidual.length,
          incomingBytes: rawContent.length,
        });
      } else {
        this._rawResidual += rawContent;
      }
      // Security: Limit tag name length to 50 chars, attribute length to 100,
      // and content length to 100k to prevent ReDoS on large payloads.
      // Limited quantifier scopes prevent catastrophic backtracking.
      const completeTagRe = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
      let mm = completeTagRe.exec(this._rawResidual);
      while (mm !== null) {
        const full = mm[0];
        try {
          // Attempt extraction from this completed segment.
          const found = extractXmlToolCalls(full, this.options.knownTools);
          extractedFromRawResidual = extractedFromRawResidual.concat(found);
        } catch {
          break;
        }
        // Always remove the matched segment from residual to avoid reprocessing,
        // even if no known tools were found in it (it may not be a tool tag)
        this._rawResidual = this._rawResidual.replace(full, '');
        // Reset lastIndex since we've mutated the residual
        completeTagRe.lastIndex = 0;
        mm = completeTagRe.exec(this._rawResidual);
      }
    }

    // Pass incoming content through the XML stream filter to reassemble any
    // fragmented XML/JSON tool_call blocks that span chunks. Then attempt
    // extraction again on the filtered output and merge unique results.
    if (this.xmlFilter && content) {
      const delta = this.xmlFilter.write(content);
      content = delta;

      // Append filtered delta to residual buffer and extract any complete
      // top-level tags that are now complete across chunks. This lets us
      // handle tool_call blocks that were split between writes.
      // Security: Enforce maxResidualBytes limit to prevent unbounded memory growth
      const maxResidualBytes = this.options.maxResidualBytes ?? DEFAULT_MAX_RESIDUAL_BYTES;
      const newResidualSize = this._rawResidual.length + this._filteredResidual.length + delta.length;
      if (maxResidualBytes > 0 && newResidualSize > maxResidualBytes) {
        this.warn(
          `Residual buffer would exceed maxResidualBytes (${maxResidualBytes}), skipping filtered delta append`,
          { currentSize: this._rawResidual.length + this._filteredResidual.length, incomingBytes: delta.length },
        );
      } else {
        this._filteredResidual += delta;
      }
      const completeTagRe = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
      let m = completeTagRe.exec(this._filteredResidual);
      while (m !== null) {
        const full = m[0];
        // Attempt to extract tool calls from the completed tag and merge
        // them into the filtered-extraction flow below by appending them
        // to the content string that will be re-scanned.
        try {
          // Remove the matched segment from the residual so it's not
          // reprocessed on subsequent chunks.
          this._filteredResidual = this._filteredResidual.replace(full, '');
          // Accumulate the found segment into content so it can be parsed
          // by the existing extraction logic.
          // Note: we intentionally do not call extractXmlToolCalls here to
          // keep merging/uniquing logic centralized below.
          content += full;
          // Reset exec index since we mutated the residual
          completeTagRe.lastIndex = 0;
          m = completeTagRe.exec(this._filteredResidual);
        } catch {
          // On any error, break to avoid infinite loops
          break;
        }
      }
    }

    const extractedFromFiltered =
      this.options.knownTools && content ? extractXmlToolCalls(content, this.options.knownTools) : [];

    // Merge results preserving order (raw, raw-residual, then filtered) but avoid duplicates
    // by comparing a stable key (name + JSON-stringified parameters).
    const seen = new Set<string>();
    const extractedXmlToolCalls: XmlToolCall[] = [];
    function pushUnique(call: XmlToolCall) {
      const key = `${call.name}|${JSON.stringify(call.parameters)}`;
      if (!seen.has(key)) {
        seen.add(key);
        extractedXmlToolCalls.push(call);
      }
    }
    for (const c of extractedFromRaw) pushUnique(c);
    for (const c of extractedFromRawResidual) pushUnique(c);
    for (const c of extractedFromFiltered) pushUnique(c);
    const nativeToolCalls = this.mapNativeToolCalls(chunk.tool_calls);
    const done = chunk.done === true;
    if (chunk.finishReason !== undefined) this._lastFinishReason = chunk.finishReason;

    this.accumulateUsage(chunk);
    this.accumulateNativeDeltas(chunk);

    // On stream end, flush the accumulator and include assembled calls.
    const accumulatedNativeCalls: XmlToolCall[] =
      done && this.nativeAccumulator ? this.mapAccumulatedNativeCalls(this.nativeAccumulator.flush()) : [];

    const toolCalls = this.enforceToolCallLimits([
      ...extractedXmlToolCalls,
      ...nativeToolCalls,
      ...accumulatedNativeCalls,
    ]);

    // Note: xmlFilter.write() was already invoked earlier to reassemble
    // fragments before extraction.

    const output = this.buildOutput({
      thinking,
      content,
      toolCalls,
      done,
      ...(done && this._lastFinishReason !== undefined ? { finishReason: this._lastFinishReason } : {}),
      ...this.usagePayload,
    });
    this.recordOutput(output);
    this.emitOutput(output);

    // Update stats after recordOutput() has accumulated content
    this._stats.parseTimeMs += performance.now() - startTime;
    if (hasThinkingInput) this._stats.thinkingBlocksCount++;
    this._stats.toolCallsCount += output.toolCalls.length;
    if (hasContentInput) this._stats.contentDeltasCount++;

    // Update buffer size based on accumulated content (updated by recordOutput)
    const bufferSize = this._accumulatedContent.length + this._accumulatedThinking.length;
    this._stats.currentBufferSize = bufferSize;
    if (bufferSize > this._stats.peakBufferSize) {
      this._stats.peakBufferSize = bufferSize;
    }
    if (this._stats.chunksProcessed > 0) {
      this._stats.averageChunkSize = this._stats.bytesProcessed / this._stats.chunksProcessed;
    }

    return output;
  }

  /**
   * Convenience method for non-streaming responses. Processes the response as a
   * complete chunk and immediately flushes, combining both outputs into one.
   */
  public processComplete(response: StreamChunk): ProcessedOutput {
    const out = this.process({ ...response, done: true });
    const flushed = this.flush();

    return this.buildOutput({
      thinking: out.thinking + flushed.thinking,
      content: out.content + flushed.content,
      toolCalls: [...out.toolCalls, ...flushed.toolCalls],
      done: true,
      ...this.usagePayload,
    });
  }

  private _flushThinkingContent(): { thinking: string; content: string; incomplete: boolean } {
    const incomplete = this.thinkingParser?.isIncomplete() ?? false;
    if (!this.thinkingParser) return { thinking: '', content: '', incomplete };
    const [thinkingDelta, contentDelta] = this.thinkingParser.flush();
    const content = this.xmlFilter && contentDelta ? this.xmlFilter.write(contentDelta) : contentDelta;
    return { thinking: thinkingDelta, content, incomplete };
  }

  /**
   * Flushes any buffered state (thinking parser, XML filter, native tool call
   * accumulator) and returns a final `ProcessedOutput` with `done: true`.
   * Always call `flush()` after the last chunk to ensure partial buffers are drained.
   * Returns `incomplete: true` if the stream appeared to end prematurely.
   */
  public flush(): ProcessedOutput {
    const { thinking, content: thinkingContent, incomplete: thinkingParserIncomplete } = this._flushThinkingContent();
    let content = thinkingContent;

    if (this.xmlFilter) {
      content += this.xmlFilter.end();
    }

    // Flush any remaining accumulated native tool calls that arrived before the done signal.
    const accumulatedNativeCalls: XmlToolCall[] = this.nativeAccumulator
      ? this.mapAccumulatedNativeCalls(this.nativeAccumulator.flush())
      : [];

    const toolCalls = this.enforceToolCallLimits(accumulatedNativeCalls);

    const incompleteness = this.detectIncompleteness(thinking, content, toolCalls);

    const output = this.buildOutput({
      thinking,
      content,
      toolCalls,
      done: true,
      ...(this._lastFinishReason !== undefined ? { finishReason: this._lastFinishReason } : {}),
      ...this.usagePayload,
    });

    // Add incompleteness for thinking tags if detected before flush
    if (thinkingParserIncomplete) {
      incompleteness.push({
        type: 'thinking',
        reason: 'Unclosed thinking tag',
      });
    }
    output.incomplete = incompleteness.length > 0;
    output.incompleteness = incompleteness;

    this.recordOutput(output);
    this.emitOutput(output);
    return output;
  }

  /** Returns all thinking text accumulated so far across every processed chunk. */
  public get accumulatedThinking(): string {
    return this._accumulatedThinking;
  }

  /** Returns the complete accumulated message (thinking, content, tool calls, usage) as a snapshot. */
  public get accumulatedMessage(): AccumulatedMessage {
    const msg: AccumulatedMessage = {
      thinking: this._accumulatedThinking,
      content: this._accumulatedContent,
      toolCalls: [...this._accumulatedToolCalls],
    };
    if (this._accumulatedUsage != null) {
      msg.usage = this._accumulatedUsage;
    }
    return msg;
  }

  /** Returns current processing statistics including buffer usage and performance metrics. */
  public getStats(): ProcessorStats {
    return { ...this._stats };
  }

  /**
   * Resets the processor to its initial state so it can be reused for a new conversation.
   * Must be called between conversations when reusing an instance.
   */
  public reset(): void {
    this.thinkingParser = this.createThinkingParser();
    this.xmlFilter = this.createXmlFilter();
    this.nativeAccumulator?.reset();
    this._accumulatedThinking = '';
    this._accumulatedContent = '';
    this._accumulatedToolCalls = [];
    this._accumulatedUsage = undefined;
    this._lastFinishReason = undefined;
    this.doneEmitted = false;
    this._warningCount = 0;
    this._stats = createEmptyStats();
  }

  private createThinkingParser(): ThinkingParser | null {
    if (!this.options.parseThinkTags) {
      return null;
    }

    const parserOptions: { openingTag?: string; closingTag?: string } = {};
    if (this.options.thinkingOpenTag !== undefined) {
      parserOptions.openingTag = this.options.thinkingOpenTag;
    }
    if (this.options.thinkingCloseTag !== undefined) {
      parserOptions.closingTag = this.options.thinkingCloseTag;
    }

    if (parserOptions.openingTag !== undefined || parserOptions.closingTag !== undefined) {
      return new ThinkingParser(parserOptions);
    }

    if (this.options.modelId !== undefined) {
      return ThinkingParser.forModel(this.options.modelId, this.options.thinkingTagMap);
    }

    return new ThinkingParser();
  }

  private createXmlFilter(): XmlStreamFilter | null {
    if (!this.options.scrubContextTags) {
      return null;
    }

    const filterOptions: {
      extraScrubTags?: Set<string>;
      overrideScrubTags?: Set<string>;
      enforcePrivacyTags?: boolean;
      maxXmlNestingDepth?: number;
      onWarning?: (message: string, context?: Record<string, unknown>) => void;
    } = {};
    if (this.options.enforcePrivacyTags !== undefined) {
      filterOptions.enforcePrivacyTags = this.options.enforcePrivacyTags;
    }
    if (this.options.onWarning !== undefined) {
      filterOptions.onWarning = this.options.onWarning;
    }
    if (this.options.maxXmlNestingDepth !== undefined) {
      filterOptions.maxXmlNestingDepth = this.options.maxXmlNestingDepth;
    }
    if (this.options.extraScrubTags !== undefined) {
      filterOptions.extraScrubTags = this.options.extraScrubTags;
    }
    if (this.options.overrideScrubTags !== undefined) {
      filterOptions.overrideScrubTags = this.options.overrideScrubTags;
    }

    return createXmlStreamFilter(filterOptions);
  }

  /** Subscribes to a stream event. Returns `this` for chaining. */
  public on<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this {
    // Security: `this.listeners` is a Map, not a plain object. Maps don't
    // have prototype chains, so dynamic key access is safe from prototype pollution.
    const listenerSet = this.listeners[event];
    if (listenerSet === undefined) {
      return this;
    }
    listenerSet.add(listener);
    return this;
  }

  /** Unsubscribes a previously registered event listener. Returns `this` for chaining. */
  public off<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this {
    // Security: `this.listeners` is a Map, not a plain object. Maps don't
    // have prototype chains, so dynamic key access is safe from prototype pollution.
    const listenerSet = this.listeners[event];
    if (listenerSet === undefined) {
      return this;
    }
    listenerSet.delete(listener);
    return this;
  }

  private buildOutput(params: {
    thinking: string;
    content: string;
    toolCalls: XmlToolCall[];
    done: boolean;
    usage?: UsageInfo;
    finishReason?: FinishReason;
  }): ProcessedOutput {
    const parts: OutputPart[] = [];

    if (params.thinking) {
      parts.push({ type: 'thinking', text: params.thinking });
    }

    if (params.content) {
      parts.push({ type: 'text', text: params.content });
    }

    for (const call of params.toolCalls) {
      parts.push({ type: 'tool_call', call, state: 'input-complete' });
    }

    const result: ProcessedOutput = {
      thinking: params.thinking,
      content: params.content,
      toolCalls: params.toolCalls,
      done: params.done,
      parts,
      incomplete: false,
      incompleteness: [],
    };
    if (params.usage !== undefined) {
      result.usage = params.usage;
    }
    if (params.finishReason !== undefined) {
      result.finishReason = params.finishReason;
    }
    return result;
  }

  private detectIncompleteness(_thinking: string, _content: string, toolCalls: XmlToolCall[]): IncompletenessDetail[] {
    return detectIncompleteness(this._accumulatedContent, toolCalls);
  }

  private recordOutput(output: ProcessedOutput): void {
    if (output.thinking) {
      this._accumulatedThinking += output.thinking;
    }
    if (output.content) {
      this._accumulatedContent += output.content;
    }
    if (output.toolCalls.length > 0) {
      this._accumulatedToolCalls.push(...output.toolCalls);
    }
  }

  private emitOutput(output: ProcessedOutput): void {
    if (output.thinking) {
      for (const listener of this.listeners.thinking) {
        listener(output.thinking);
      }
    }

    if (output.content) {
      for (const listener of this.listeners.text) {
        listener(output.content);
      }
    }

    if (output.toolCalls.length > 0) {
      for (const call of output.toolCalls) {
        for (const listener of this.listeners.tool_call) {
          listener(call);
        }
      }
    }

    if (output.done && !this.doneEmitted) {
      this.doneEmitted = true;
      for (const listener of this.listeners.done) {
        listener();
      }
    }
  }

  private accumulateUsage(chunk: StreamChunk): void {
    if (chunk.usage === undefined) return;
    this._accumulatedUsage = { ...this._accumulatedUsage, ...chunk.usage };
    for (const listener of this.listeners.usage) {
      listener(this._accumulatedUsage);
    }
  }

  private accumulateNativeDeltas(chunk: StreamChunk): void {
    if (!this.nativeAccumulator || !Array.isArray(chunk.nativeToolCallDeltas)) return;
    const maxArgumentBytes = this.options.maxToolArgumentBytes ?? DEFAULT_MAX_TOOL_ARGUMENT_BYTES;
    for (const delta of chunk.nativeToolCallDeltas) {
      if (
        maxArgumentBytes > 0 &&
        typeof delta.argumentsDelta === 'string' &&
        delta.argumentsDelta.length > maxArgumentBytes
      ) {
        this.warn('Native tool call argumentsDelta exceeded maxToolArgumentBytes; truncating before accumulation.', {
          maxToolArgumentBytes: maxArgumentBytes,
        });
        this.nativeAccumulator.addDelta({
          ...delta,
          argumentsDelta: delta.argumentsDelta.slice(0, maxArgumentBytes),
        });
      } else {
        this.nativeAccumulator.addDelta(delta);
      }
    }
  }

  private mapAccumulatedNativeCalls(
    calls: import('../tool-calls/ToolCallAccumulator.js').NativeToolCall[],
  ): XmlToolCall[] {
    return calls.map(call => {
      const mapped: XmlToolCall = {
        name: call.name,
        parameters: call.arguments,
        format: 'native-json' as const,
      };
      if (call.id !== undefined) mapped.id = call.id;
      return mapped;
    });
  }

  private mapNativeToolCalls(calls: StreamChunk['tool_calls']): XmlToolCall[] {
    if (!Array.isArray(calls) || calls.length === 0) {
      return [];
    }

    const mapped: XmlToolCall[] = [];

    for (const call of calls) {
      const name = typeof call?.function?.name === 'string' ? call.function.name : null;
      if (!name) {
        continue;
      }

      mapped.push({
        name,
        parameters: this.normalizeToolArguments(call.function?.arguments),
        format: 'native-json',
      });
    }

    return mapped;
  }

  private enforceToolCallLimits(toolCalls: XmlToolCall[]): XmlToolCall[] {
    const maxToolCalls = this.options.maxToolCallsPerMessage ?? DEFAULT_MAX_TOOL_CALLS_PER_MESSAGE;
    const maxToolArgumentBytes = this.options.maxToolArgumentBytes ?? DEFAULT_MAX_TOOL_ARGUMENT_BYTES;

    // Account for tool calls already accumulated from previous process() calls so
    // the per-message cap is enforced across the full stream, not just per-chunk.
    const alreadyAccumulated = this._accumulatedToolCalls.length;

    let limitedCalls = toolCalls;
    if (maxToolCalls > 0) {
      const remaining = maxToolCalls - alreadyAccumulated;
      if (remaining <= 0) {
        if (toolCalls.length > 0) {
          this.warn('Tool call count exceeded maxToolCallsPerMessage; dropping all new tool calls.', {
            maxToolCallsPerMessage: maxToolCalls,
            accumulated: alreadyAccumulated,
          });
        }
        limitedCalls = [];
      } else if (toolCalls.length > remaining) {
        this.warn('Tool call count exceeded maxToolCallsPerMessage; truncating tool call list.', {
          maxToolCallsPerMessage: maxToolCalls,
          originalCount: toolCalls.length,
        });
        limitedCalls = toolCalls.slice(0, remaining);
      }
    }

    const keptCalls: XmlToolCall[] = [];
    for (const call of limitedCalls) {
      if (this.filterByArgumentSize(call, maxToolArgumentBytes)) {
        keptCalls.push(call);
      }
    }

    return keptCalls;
  }

  private filterByArgumentSize(call: XmlToolCall, maxToolArgumentBytes: number): boolean {
    if (maxToolArgumentBytes <= 0) return true;
    let argsBytes: number;
    try {
      const argsJson = JSON.stringify(call.parameters);
      argsBytes = SHARED_TEXT_ENCODER.encode(argsJson).byteLength;
    } catch {
      this.warn('Tool call arguments could not be serialized; dropping tool call.', {
        toolName: call.name,
      });
      return false;
    }
    if (argsBytes > maxToolArgumentBytes) {
      this.warn('Tool call arguments exceeded maxToolArgumentBytes; dropping tool call.', {
        toolName: call.name,
        maxToolArgumentBytes,
        actualBytes: argsBytes,
      });
      return false;
    }
    return true;
  }

  private normalizeToolArguments(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Ignore malformed tool argument payloads; treat as empty args.
      }
    }

    return {};
  }

  private ensureText(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private estimateChunkSize(chunk: StreamChunk): number {
    let size = 0;
    if (typeof chunk.content === 'string') size += SHARED_TEXT_ENCODER.encode(chunk.content).length;
    if (typeof chunk.thinking === 'string') size += SHARED_TEXT_ENCODER.encode(chunk.thinking).length;
    if (Array.isArray(chunk.tool_calls)) {
      for (const call of chunk.tool_calls) {
        try {
          size += JSON.stringify(call).length;
        } catch {
          // Skip serialization errors (circular refs, BigInt, etc.)
        }
      }
    }
    if (Array.isArray(chunk.nativeToolCallDeltas)) {
      for (const delta of chunk.nativeToolCallDeltas) {
        try {
          size += JSON.stringify(delta).length;
        } catch {
          // Skip serialization errors
        }
      }
    }
    return size;
  }

  private enforceMaxLength(value: string, field: 'content' | 'thinking'): string {
    const max = this.options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
    if (max <= 0 || value.length <= max) {
      return value;
    }

    this.warn(`Chunk ${field} exceeded maxInputLength and was truncated`, {
      field,
      maxInputLength: max,
      originalLength: value.length,
    });

    // Truncate at a tag boundary so we don't hand a partial `<tag...` fragment
    // to the XML parser. Walk back from the cut point to the last `<` that has
    // no matching `>` after it within the kept region.
    let cut = max;
    const openIdx = value.lastIndexOf('<', max - 1);
    if (openIdx !== -1) {
      const closeIdx = value.indexOf('>', openIdx);
      // If the closing `>` is beyond the cut (or absent), the tag is partial.
      if (closeIdx === -1 || closeIdx >= max) {
        cut = openIdx;
      }
    }

    return value.slice(0, cut);
  }

  private warn(message: string, context?: Record<string, unknown>): void {
    const max = this.options.maxWarnings ?? DEFAULT_MAX_WARNINGS;
    if (max === 0 || this._warningCount >= max) {
      return;
    }
    this._warningCount++;
    this.options.onWarning?.(message, context);
    for (const listener of this.listeners.warning) {
      listener(message, context);
    }
  }
}
