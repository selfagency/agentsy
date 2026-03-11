import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';

import type { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import type { StreamChunk } from '../processor/types.js';

type MarkdownSink = {
  markdown: (text: string) => void | Promise<void>;
};

type ReportSink = {
  report: (part: { type: 'text'; text: string }) => void | Promise<void>;
};

export type VSCodeChatStream = MarkdownSink | ReportSink;

export function createVSCodeCopilotAdapter(options: {
  processor: LLMStreamProcessor;
  stream: VSCodeChatStream;
  onToolCall: (call: XmlToolCall) => void | Promise<void>;
  showThinking?: boolean;
}): {
  write(chunk: StreamChunk): Promise<void>;
  end(): Promise<void>;
} {
  let thinkingAtLineStart = true;

  const emitText = async (text: string): Promise<void> => {
    if (!text) {
      return;
    }
    if ('markdown' in options.stream) {
      await options.stream.markdown(text);
      return;
    }
    await options.stream.report({ type: 'text', text });
  };

  const emitThinking = async (text: string): Promise<void> => {
    if (!text || options.showThinking !== true) {
      return;
    }
    const quoted = appendToBlockquote(text, thinkingAtLineStart);
    thinkingAtLineStart = text.endsWith('\n');
    await emitText(quoted);
  };

  return {
    async write(chunk: StreamChunk): Promise<void> {
      const out = options.processor.process(chunk);
      await emitThinking(out.thinking);
      await emitText(out.content);
      for (const call of out.toolCalls) {
        await options.onToolCall(call);
      }
    },
    async end(): Promise<void> {
      const out = options.processor.flush();
      await emitText(out.content);
    },
  };
}

function appendToBlockquote(text: string, atLineStart: boolean): string {
  const parts: string[] = [];
  let isLineStart = atLineStart;

  for (const char of text) {
    if (isLineStart) {
      parts.push('> ');
      isLineStart = false;
    }
    parts.push(char);
    if (char === '\n') {
      isLineStart = true;
    }
  }

  return parts.join('');
}
