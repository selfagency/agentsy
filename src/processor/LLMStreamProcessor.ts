import type { NativeToolCallDelta, UsageInfo } from '../normalizers/types.js';
import { ThinkingParser, type ThinkingTagPair } from '../thinking/ThinkingParser.js';
import { ToolCallAccumulator } from '../tool-calls/ToolCallAccumulator.js';
import { extractXmlToolCalls, type XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import { createXmlStreamFilter, type XmlStreamFilter } from '../xml-filter/XmlStreamFilter.js';
import type { AccumulatedMessage } from './AccumulatedMessage.js';

export interface StreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
  done?: boolean;
  /** Token usage information, populated on the final chunk from the normalizer layer. */
  usage?: UsageInfo;
  /** Streaming deltas for native (non-XML) tool calls from providers that use JSON-format tool calls. */
  nativeToolCallDeltas?: NativeToolCallDelta[];
}

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
  /** Maximum number of warnings emitted per processor lifetime. Default: 100. Set to 0 to disable. */
  maxWarnings?: number;
}

export type OutputPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: XmlToolCall };

export interface ProcessedOutput {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  done: boolean;
  parts: OutputPart[];
  /** Accumulated token usage, populated from the last chunk that carried usage data. */
  usage?: UsageInfo;
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
const DEFAULT_MAX_WARNINGS = 100;

export class LLMStreamProcessor {
  private readonly options: Required<Pick<ProcessorOptions, 'parseThinkTags' | 'scrubContextTags'>> & ProcessorOptions;
  private thinkingParser: ThinkingParser | null;
  private xmlFilter: XmlStreamFilter | null;
  private readonly nativeAccumulator: ToolCallAccumulator | null;

  private _accumulatedThinking = '';
  private _accumulatedContent = '';
  private _accumulatedToolCalls: XmlToolCall[] = [];
  private _accumulatedUsage: UsageInfo | undefined = undefined;
  private doneEmitted = false;
  private _warningCount = 0;

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

  public constructor(options: ProcessorOptions = {}) {
    this.options = {
      ...options,
      parseThinkTags: options.parseThinkTags ?? true,
      scrubContextTags: options.scrubContextTags ?? true,
    };

    this.thinkingParser = this.createThinkingParser();
    this.xmlFilter = this.createXmlFilter();
    this.nativeAccumulator = (options.accumulateNativeToolCalls ?? true) ? new ToolCallAccumulator() : null;
  }

  public process(chunk: StreamChunk): ProcessedOutput {
    const rawThinking = this.enforceMaxLength(this.ensureText(chunk.thinking), 'thinking');
    const rawContent = this.enforceMaxLength(this.ensureText(chunk.content), 'content');

    let thinking = rawThinking;
    let content = rawContent;

    if (this.thinkingParser && content) {
      const [thinkingDelta, contentDelta] = this.thinkingParser.addContent(content);
      thinking += thinkingDelta;
      content = contentDelta;
    }

    const extractedXmlToolCalls =
      this.options.knownTools && rawContent ? extractXmlToolCalls(rawContent, this.options.knownTools) : [];
    const nativeToolCalls = this.mapNativeToolCalls(chunk.tool_calls);
    const done = chunk.done === true;

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

    if (this.xmlFilter && content) {
      content = this.xmlFilter.write(content);
    }

    const output = this.buildOutput({
      thinking,
      content,
      toolCalls,
      done,
      ...(this._accumulatedUsage != null ? { usage: this._accumulatedUsage } : {}),
    });
    this.recordOutput(output);
    this.emitOutput(output);
    return output;
  }

  public processComplete(response: StreamChunk): ProcessedOutput {
    const out = this.process({ ...response, done: true });
    const flushed = this.flush();

    return this.buildOutput({
      thinking: out.thinking + flushed.thinking,
      content: out.content + flushed.content,
      toolCalls: [...out.toolCalls, ...flushed.toolCalls],
      done: true,
      ...(this._accumulatedUsage != null ? { usage: this._accumulatedUsage } : {}),
    });
  }

  public flush(): ProcessedOutput {
    let thinking = '';
    let content = '';

    if (this.thinkingParser) {
      const [thinkingDelta, contentDelta] = this.thinkingParser.flush();
      thinking = thinkingDelta;
      if (this.xmlFilter && contentDelta) {
        content = this.xmlFilter.write(contentDelta);
      } else {
        content = contentDelta;
      }
    }

    if (this.xmlFilter) {
      content += this.xmlFilter.end();
    }

    // Flush any remaining accumulated native tool calls that arrived before the done signal.
    const accumulatedNativeCalls: XmlToolCall[] = this.nativeAccumulator
      ? this.mapAccumulatedNativeCalls(this.nativeAccumulator.flush())
      : [];

    const toolCalls = this.enforceToolCallLimits(accumulatedNativeCalls);

    const output = this.buildOutput({
      thinking,
      content,
      toolCalls,
      done: true,
      ...(this._accumulatedUsage != null ? { usage: this._accumulatedUsage } : {}),
    });

    this.recordOutput(output);
    this.emitOutput(output);
    return output;
  }

  public get accumulatedThinking(): string {
    return this._accumulatedThinking;
  }

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

  public reset(): void {
    this.thinkingParser = this.createThinkingParser();
    this.xmlFilter = this.createXmlFilter();
    this.nativeAccumulator?.reset();
    this._accumulatedThinking = '';
    this._accumulatedContent = '';
    this._accumulatedToolCalls = [];
    this._accumulatedUsage = undefined;
    this.doneEmitted = false;
    this._warningCount = 0;
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

  public on<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this {
    this.listeners[event].add(listener);
    return this;
  }

  public off<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this {
    this.listeners[event].delete(listener);
    return this;
  }

  private buildOutput(params: {
    thinking: string;
    content: string;
    toolCalls: XmlToolCall[];
    done: boolean;
    usage?: UsageInfo;
  }): ProcessedOutput {
    const parts: OutputPart[] = [];

    if (params.thinking) {
      parts.push({ type: 'thinking', text: params.thinking });
    }

    if (params.content) {
      parts.push({ type: 'text', text: params.content });
    }

    for (const call of params.toolCalls) {
      parts.push({ type: 'tool_call', call });
    }

    const result: ProcessedOutput = {
      thinking: params.thinking,
      content: params.content,
      toolCalls: params.toolCalls,
      done: params.done,
      parts,
    };
    if (params.usage !== undefined) {
      result.usage = params.usage;
    }
    return result;
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
    return calls.map(call => ({
      name: call.name,
      parameters: call.arguments,
      format: 'native-json' as const,
    }));
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
    const encoder = new TextEncoder();
    let argsBytes: number;
    try {
      const argsJson = JSON.stringify(call.parameters);
      argsBytes = encoder.encode(argsJson).byteLength;
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

    return value.slice(0, max);
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
