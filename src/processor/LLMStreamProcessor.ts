import { ThinkingParser } from '../thinking/ThinkingParser.js';
import { extractXmlToolCalls, type XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import { createXmlStreamFilter, type XmlStreamFilter } from '../xml-filter/XmlStreamFilter.js';
import type { AccumulatedMessage } from './AccumulatedMessage.js';

export interface StreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
  done?: boolean;
}

export interface ProcessorOptions {
  parseThinkTags?: boolean;
  scrubContextTags?: boolean;
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
  enforcePrivacyTags?: boolean;
  knownTools?: Set<string>;
  thinkingOpenTag?: string;
  thinkingCloseTag?: string;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
  maxInputLength?: number;
  maxToolCallsPerMessage?: number;
  maxToolArgumentBytes?: number;
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
}

export type StreamEventMap = {
  text: (delta: string) => void;
  thinking: (delta: string) => void;
  tool_call: (call: XmlToolCall) => void;
  done: () => void;
  warning: (message: string, context?: Record<string, unknown>) => void;
};

const DEFAULT_MAX_INPUT_LENGTH = 256 * 1024;
const DEFAULT_MAX_TOOL_CALLS_PER_MESSAGE = 64;
const DEFAULT_MAX_TOOL_ARGUMENT_BYTES = 128 * 1024;

export class LLMStreamProcessor {
  private readonly options: Required<Pick<ProcessorOptions, 'parseThinkTags' | 'scrubContextTags'>> & ProcessorOptions;
  private thinkingParser: ThinkingParser | null;
  private xmlFilter: XmlStreamFilter | null;

  private _accumulatedThinking = '';
  private _accumulatedContent = '';
  private _accumulatedToolCalls: XmlToolCall[] = [];
  private doneEmitted = false;

  private listeners: {
    [K in keyof StreamEventMap]: Set<StreamEventMap[K]>;
  } = {
    text: new Set(),
    thinking: new Set(),
    tool_call: new Set(),
    done: new Set(),
    warning: new Set(),
  };

  public constructor(options: ProcessorOptions = {}) {
    this.options = {
      ...options,
      parseThinkTags: options.parseThinkTags ?? true,
      scrubContextTags: options.scrubContextTags ?? true,
    };

    this.thinkingParser = this.createThinkingParser();
    this.xmlFilter = this.createXmlFilter();
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
      this.options.knownTools && rawContent
        ? extractXmlToolCalls(rawContent, this.options.knownTools)
        : [];
    const nativeToolCalls = this.mapNativeToolCalls(chunk.tool_calls);
    const toolCalls = this.enforceToolCallLimits([...extractedXmlToolCalls, ...nativeToolCalls]);

    if (this.xmlFilter && content) {
      content = this.xmlFilter.write(content);
    }

    const done = chunk.done === true;
    const output = this.buildOutput({ thinking, content, toolCalls, done });
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

    const output = this.buildOutput({
      thinking,
      content,
      toolCalls: [],
      done: true,
    });

    this.recordOutput(output);
    this.emitOutput(output);
    return output;
  }

  public get accumulatedThinking(): string {
    return this._accumulatedThinking;
  }

  public get accumulatedMessage(): AccumulatedMessage {
    return {
      thinking: this._accumulatedThinking,
      content: this._accumulatedContent,
      toolCalls: [...this._accumulatedToolCalls],
    };
  }

  public reset(): void {
    this.thinkingParser = this.createThinkingParser();
    this.xmlFilter = this.createXmlFilter();
    this._accumulatedThinking = '';
    this._accumulatedContent = '';
    this._accumulatedToolCalls = [];
    this.doneEmitted = false;
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

    return new ThinkingParser(parserOptions);
  }

  private createXmlFilter(): XmlStreamFilter | null {
    if (!this.options.scrubContextTags) {
      return null;
    }

    const filterOptions: {
      extraScrubTags?: Set<string>;
      overrideScrubTags?: Set<string>;
      enforcePrivacyTags?: boolean;
      onWarning?: (message: string, context?: Record<string, unknown>) => void;
    } = {};
    if (this.options.enforcePrivacyTags !== undefined) {
      filterOptions.enforcePrivacyTags = this.options.enforcePrivacyTags;
    }
    if (this.options.onWarning !== undefined) {
      filterOptions.onWarning = this.options.onWarning;
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

    return {
      thinking: params.thinking,
      content: params.content,
      toolCalls: params.toolCalls,
      done: params.done,
      parts,
    };
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

  private mapNativeToolCalls(
    calls: StreamChunk['tool_calls'],
  ): XmlToolCall[] {
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
        format: 'json-wrapped',
      });
    }

    return mapped;
  }

  private enforceToolCallLimits(toolCalls: XmlToolCall[]): XmlToolCall[] {
    const maxToolCalls = this.options.maxToolCallsPerMessage ?? DEFAULT_MAX_TOOL_CALLS_PER_MESSAGE;
    const maxToolArgumentBytes = this.options.maxToolArgumentBytes ?? DEFAULT_MAX_TOOL_ARGUMENT_BYTES;

    let limitedCalls = toolCalls;
    if (maxToolCalls > 0 && toolCalls.length > maxToolCalls) {
      this.warn('Tool call count exceeded maxToolCallsPerMessage; truncating tool call list.', {
        maxToolCallsPerMessage: maxToolCalls,
        originalCount: toolCalls.length,
      });
      limitedCalls = toolCalls.slice(0, maxToolCalls);
    }

    const keptCalls: XmlToolCall[] = [];
    for (const call of limitedCalls) {
      const argsBytes = Buffer.byteLength(JSON.stringify(call.parameters), 'utf8');
      if (maxToolArgumentBytes > 0 && argsBytes > maxToolArgumentBytes) {
        this.warn('Tool call arguments exceeded maxToolArgumentBytes; dropping tool call.', {
          toolName: call.name,
          maxToolArgumentBytes,
          actualBytes: argsBytes,
        });
        continue;
      }

      keptCalls.push(call);
    }

    return keptCalls;
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

    this.warn(
      `Chunk ${field} exceeded maxInputLength and was truncated`,
      { field, maxInputLength: max, originalLength: value.length },
    );

    return value.slice(0, max);
  }

  private warn(message: string, context?: Record<string, unknown>): void {
    this.options.onWarning?.(message, context);
    for (const listener of this.listeners.warning) {
      listener(message, context);
    }
  }
}
