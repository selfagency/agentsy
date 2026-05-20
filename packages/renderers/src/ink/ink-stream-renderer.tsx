import type { JsonObject } from '@agentsy/types';
import { Box } from 'ink';
import { useEffect, useState } from 'react';

import type { KeyboardOptions } from './components/keyboard-handler.js';
import { KeyboardHandler } from './components/keyboard-handler.js';
import { StreamingText } from './components/streaming-text.js';
import { ThinkingBlock } from './components/thinking-block.js';
import { ToolCallBlock } from './components/tool-call-block.js';
import type { Theme } from './themes/types.js';

interface InkStreamRendererProps {
  readonly stateRef: {
    text: string;
    thinking: string;
    toolCalls: readonly {
      id: string;
      name: string;
      arguments: JsonObject;
      done: boolean;
    }[];
    isStreaming: boolean;
  };
  readonly forceUpdateRef: { current: () => void };
  readonly setForceUpdate: (fn: () => void) => void;
  readonly options: {
    readonly showThinking?: boolean | undefined;
    readonly thinkingStyle?: 'blockquote' | 'inline' | 'suppress' | undefined;
    readonly showToolCalls?: boolean | undefined;
    readonly markdown?: boolean | undefined;
    readonly theme: Theme;
    readonly screenReader?: boolean | undefined;
    readonly syntaxHighlight?: boolean | undefined;
    readonly keyboard?: KeyboardOptions | undefined;
  };
}

interface RenderOptions {
  readonly showThinking: boolean;
  readonly thinkingStyle: 'blockquote' | 'inline' | 'suppress';
  readonly showToolCalls: boolean;
  readonly markdown: boolean;
  readonly theme: Theme;
  readonly screenReader: boolean;
  readonly syntaxHighlight: boolean;
}

function ToolCallsRenderer({
  toolCalls,
  theme,
  screenReader
}: {
  readonly toolCalls: readonly {
    id: string;
    name: string;
    arguments: JsonObject;
    done: boolean;
  }[];
  readonly theme: Theme;
  readonly screenReader: boolean;
}) {
  if (!toolCalls.length) {
    return null;
  }
  return (
    <>
      {toolCalls.map(call => (
        <ToolCallBlock key={call.id} call={call} theme={theme} screenReader={screenReader} />
      ))}
    </>
  );
}

function ThinkingSection({
  thinking,
  isStreaming,
  options
}: {
  readonly thinking: string;
  readonly isStreaming: boolean;
  readonly options: RenderOptions;
}) {
  if (!options.showThinking || !thinking) {
    return null;
  }
  return (
    <ThinkingBlock
      text={thinking}
      style={options.thinkingStyle}
      isStreaming={isStreaming}
      theme={options.theme}
      screenReader={options.screenReader}
    />
  );
}

function ToolCallsSection({
  toolCalls,
  options
}: {
  readonly toolCalls: readonly {
    id: string;
    name: string;
    arguments: JsonObject;
    done: boolean;
  }[];
  readonly options: RenderOptions;
}) {
  if (!options.showToolCalls) {
    return null;
  }
  return <ToolCallsRenderer toolCalls={toolCalls} theme={options.theme} screenReader={options.screenReader} />;
}

function ThinkingContent({
  thinking,
  isStreaming,
  options
}: {
  readonly thinking: string;
  readonly isStreaming: boolean;
  readonly options: RenderOptions;
}) {
  return <ThinkingSection thinking={thinking} isStreaming={isStreaming} options={options} />;
}

function ToolCallsContent({
  toolCalls,
  options
}: {
  readonly toolCalls: readonly {
    id: string;
    name: string;
    arguments: JsonObject;
    done: boolean;
  }[];
  readonly options: RenderOptions;
}) {
  return <ToolCallsSection toolCalls={toolCalls} options={options} />;
}

function TextContent({
  text,
  isStreaming,
  options
}: {
  readonly text: string;
  readonly isStreaming: boolean;
  readonly options: RenderOptions;
}) {
  return (
    <StreamingText
      text={text}
      markdown={options.markdown}
      isStreaming={isStreaming}
      theme={options.theme}
      screenReader={options.screenReader}
      syntaxHighlight={options.syntaxHighlight}
    />
  );
}

function ContentRenderer({
  text,
  thinking,
  toolCalls,
  isStreaming,
  options
}: {
  readonly text: string;
  readonly thinking: string;
  readonly toolCalls: readonly {
    id: string;
    name: string;
    arguments: JsonObject;
    done: boolean;
  }[];
  readonly isStreaming: boolean;
  readonly options: RenderOptions;
}) {
  return (
    <Box flexDirection="column">
      <ThinkingContent thinking={thinking} isStreaming={isStreaming} options={options} />
      <ToolCallsContent toolCalls={toolCalls} options={options} />
      <TextContent text={text} isStreaming={isStreaming} options={options} />
    </Box>
  );
}

function buildRenderOptions(options: InkStreamRendererProps['options']): RenderOptions {
  return {
    markdown: options.markdown ?? true,
    screenReader: options.screenReader ?? false,
    showThinking: options.showThinking ?? true,
    showToolCalls: options.showToolCalls ?? true,
    syntaxHighlight: options.syntaxHighlight ?? false,
    theme: options.theme,
    thinkingStyle: options.thinkingStyle ?? 'blockquote'
  };
}

// fallow-ignore-next-line unused-export
export default function InkStreamRenderer({
  stateRef,
  forceUpdateRef: _forceUpdateRef,
  setForceUpdate,
  options
}: InkStreamRendererProps) {
  // nosemgrep: react-use-state-destructure
  // _tick is intentionally unused; setTick is used to force re-renders when stateRef is mutated externally.
  const [_tick, setTick] = useState(0);

  useEffect(() => {
    setForceUpdate(() => {
      setTick(t => t + 1);
    });
  }, [setForceUpdate]);

  const renderOptions = buildRenderOptions(options);

  return (
    <Box flexDirection="column">
      <ContentRenderer
        text={stateRef.text}
        thinking={stateRef.thinking}
        toolCalls={stateRef.toolCalls}
        isStreaming={stateRef.isStreaming}
        options={renderOptions}
      />
      {options.keyboard?.enabled === true && <KeyboardHandler keyboard={options.keyboard} />}
    </Box>
  );
}
