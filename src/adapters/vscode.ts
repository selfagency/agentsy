import { appendToBlockquote } from '../markdown/appendToBlockquote.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import type { LLMStreamProcessor, StreamChunk } from '../processor/LLMStreamProcessor.js';
import type { FinishReason } from '../tool-calls/types.js';
import type { UsageInfo } from '../normalizers/types.js';

export interface VSCodeChatStream {
  markdown(text: string): void | Promise<void>;
}

export interface VSCodeCopilotAdapterOptions {
  processor: LLMStreamProcessor;
  stream: VSCodeChatStream;
  onToolCall: (call: XmlToolCall) => void | Promise<void>;
  onFinish?: (finishReason: FinishReason | undefined, usage: UsageInfo | undefined) => void | Promise<void>;
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
      await options.stream.markdown(formatted);
      if (formatted.length > 0) {
        const lastChar = formatted.at(-1);
        thinkingLineStart = lastChar === '\n' || lastChar === '\r';
      }
      // If nothing was emitted, preserve the previous line-start state.
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

      // Fire onFinish callback if stream is done
      if (chunk.done === true && options.onFinish) {
        await options.onFinish(chunk.finishReason, chunk.usage);
      }
    },
    async end(): Promise<void> {
      await emit(options.processor.flush());
    },
  };
}
