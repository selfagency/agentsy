import { appendToBlockquote } from '../markdown/appendToBlockquote.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import type { LLMStreamProcessor, StreamChunk } from '../processor/LLMStreamProcessor.js';

export interface VSCodeChatStream {
  markdown(text: string): void | Promise<void>;
}

export interface VSCodeCopilotAdapterOptions {
  processor: LLMStreamProcessor;
  stream: VSCodeChatStream;
  onToolCall: (call: XmlToolCall) => void | Promise<void>;
  showThinking?: boolean;
}

export function createVSCodeCopilotAdapter(options: VSCodeCopilotAdapterOptions): {
  write(chunk: StreamChunk): Promise<void>;
  end(): Promise<void>;
} {
  const showThinking = options.showThinking ?? true;
  let thinkingStarted = false;
  let thinkingLineStart = true;
  let contentStarted = false;

  async function emit(output: ReturnType<LLMStreamProcessor['process']>): Promise<void> {
    if (output.thinking && showThinking) {
      if (!thinkingStarted) {
        await options.stream.markdown('\n\n> 💭 **Thinking**\n>\n');
        thinkingStarted = true;
        thinkingLineStart = true;
      }

      const formatted = appendToBlockquote(output.thinking, thinkingLineStart);
      thinkingLineStart = false;
      await options.stream.markdown(formatted);
    }

    if (output.content) {
      if (thinkingStarted && !contentStarted) {
        await options.stream.markdown('\n\n');
        contentStarted = true;
      }
      await options.stream.markdown(output.content);
    }

    for (const toolCall of output.toolCalls) {
      await options.onToolCall(toolCall);
    }
  }

  return {
    async write(chunk: StreamChunk): Promise<void> {
      await emit(options.processor.process(chunk));
    },
    async end(): Promise<void> {
      await emit(options.processor.flush());
    },
  };
}
