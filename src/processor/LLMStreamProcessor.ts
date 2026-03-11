import { ThinkingParser } from '../thinking/ThinkingParser.js';
import { extractXmlToolCalls, type XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import { createXmlStreamFilter } from '../xml-filter/XmlStreamFilter.js';

import type { AccumulatedMessage, ProcessedOutput, ProcessorOptions, StreamChunk, StreamEventMap } from './types.js';

export class LLMStreamProcessor {
  private readonly _options: Required<
    Pick<ProcessorOptions, 'parseThinkTags' | 'scrubContextTags' | 'onWarning'>
  > &
    Omit<ProcessorOptions, 'parseThinkTags' | 'scrubContextTags' | 'onWarning'>;

  private readonly _thinkingParser: ThinkingParser;
  private readonly _xmlFilter = createXmlStreamFilter();
  private readonly _listeners: { [K in keyof StreamEventMap]: Set<StreamEventMap[K]> } = {
    text: new Set(),
    thinking: new Set(),
    tool_call: new Set(),
    done: new Set(),
    warning: new Set(),
  };

  private _accumulatedThinking = '';
  private _accumulatedContent = '';
  private _accumulatedToolCalls: XmlToolCall[] = [];

  public constructor(options: ProcessorOptions = {}) {
    this._options = {
      parseThinkTags: options.parseThinkTags ?? true,
      scrubContextTags: options.scrubContextTags ?? true,
      onWarning: options.onWarning ?? (() => {}),
      ...options,
    };

    const thinkingOptions: { openingTag?: string; closingTag?: string } = {};
    if (options.thinkingOpenTag !== undefined) {
      thinkingOptions.openingTag = options.thinkingOpenTag;
    }
    if (options.thinkingCloseTag !== undefined) {
      thinkingOptions.closingTag = options.thinkingCloseTag;
    }

    this._thinkingParser = new ThinkingParser(thinkingOptions);
  }

  public on<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this {
    this._listeners[event].add(listener);
    return this;
  }

  public off<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this {
    this._listeners[event].delete(listener);
    return this;
  }

  public process(chunk: StreamChunk): ProcessedOutput {
    const nativeThinking = chunk.thinking ?? '';
    const contentInput = chunk.content ?? '';

    let thinkingDelta = nativeThinking;
    let contentForToolParsing = contentInput;

    if (this._options.parseThinkTags && contentInput) {
      const [thinkingFromContent, nonThinkingContent] = this._thinkingParser.addContent(contentInput);
      thinkingDelta += thinkingFromContent;
      contentForToolParsing = nonThinkingContent;
    }

    const xmlToolCalls = this._options.knownTools
      ? extractXmlToolCalls(contentForToolParsing, this._options.knownTools)
      : [];

    const nativeToolCalls = (chunk.tool_calls ?? []).map(call => ({
      name: call.function.name,
      parameters:
        call.function.arguments && typeof call.function.arguments === 'object' && !Array.isArray(call.function.arguments)
          ? (call.function.arguments as Record<string, unknown>)
          : {},
      format: 'json-wrapped' as const,
    }));

    const toolCalls = [...nativeToolCalls, ...xmlToolCalls];

    let contentDelta = contentForToolParsing;
    if (this._options.scrubContextTags && contentDelta) {
      contentDelta = this._xmlFilter.write(contentDelta);
    }

    const parts: ProcessedOutput['parts'] = [];
    if (thinkingDelta) {
      parts.push({ type: 'thinking', text: thinkingDelta });
    }
    if (contentDelta) {
      parts.push({ type: 'text', text: contentDelta });
    }
    for (const toolCall of toolCalls) {
      parts.push({ type: 'tool_call', call: toolCall });
    }

    this._accumulatedThinking += thinkingDelta;
    this._accumulatedContent += contentDelta;
    this._accumulatedToolCalls.push(...toolCalls);

    this._emitIf('thinking', thinkingDelta);
    this._emitIf('text', contentDelta);
    for (const toolCall of toolCalls) {
      this._emit('tool_call', toolCall);
    }

    const done = Boolean(chunk.done);
    if (done) {
      this._emit('done');
    }

    return {
      thinking: thinkingDelta,
      content: contentDelta,
      toolCalls,
      done,
      parts,
    };
  }

  public processComplete(response: StreamChunk): ProcessedOutput {
    const first = this.process(response);
    const flushed = this.flush();

    return {
      thinking: first.thinking + flushed.thinking,
      content: first.content + flushed.content,
      toolCalls: [...first.toolCalls, ...flushed.toolCalls],
      done: true,
      parts: [...first.parts, ...flushed.parts],
    };
  }

  public flush(): ProcessedOutput {
    const contentDelta = this._options.scrubContextTags ? this._xmlFilter.end() : '';

    if (contentDelta) {
      this._accumulatedContent += contentDelta;
      this._emit('text', contentDelta);
    }

    return {
      thinking: '',
      content: contentDelta,
      toolCalls: [],
      done: false,
      parts: contentDelta ? [{ type: 'text', text: contentDelta }] : [],
    };
  }

  public reset(): void {
    this._thinkingParser.reset();
    this._accumulatedThinking = '';
    this._accumulatedContent = '';
    this._accumulatedToolCalls = [];
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

  private _emit<K extends keyof StreamEventMap>(event: K, ...args: unknown[]): void {
    for (const listener of this._listeners[event]) {
      (listener as (...listenerArgs: unknown[]) => void)(...args);
    }
  }

  private _emitIf<K extends 'text' | 'thinking'>(event: K, value: string): void {
    if (value) {
      this._emit(event, value);
    }
  }
}
