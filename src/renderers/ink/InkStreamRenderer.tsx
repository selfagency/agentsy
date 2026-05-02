import { Box } from 'ink';
import { useEffect, useState } from 'react';
import type { KeyboardOptions } from './components/KeyboardHandler.js';
import { KeyboardHandler } from './components/KeyboardHandler.js';
import { StreamingText } from './components/StreamingText.js';
import { ThinkingBlock } from './components/ThinkingBlock.js';
import { ToolCallBlock } from './components/ToolCallBlock.js';
import type { Theme } from './themes/types.js';

interface InkStreamRendererProps {
  readonly stateRef: {
    text: string;
    thinking: string;
    toolCalls: readonly { id: string; name: string; arguments: Record<string, unknown>; done: boolean }[];
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
  showThinking: boolean;
  thinkingStyle: 'blockquote' | 'inline' | 'suppress';
  showToolCalls: boolean;
  markdown: boolean;
  theme: Theme;
  screenReader: boolean;
  syntaxHighlight: boolean;
}

function ContentRenderer({
  text,
  thinking,
  toolCalls,
  isStreaming,
  options,
}: {
  text: string;
  thinking: string;
  toolCalls: readonly { id: string; name: string; arguments: Record<string, unknown>; done: boolean }[];
  isStreaming: boolean;
  options: RenderOptions;
}) {
  return (
    <Box flexDirection="column">
      {options.showThinking && thinking && (
        <ThinkingBlock
          text={thinking}
          style={options.thinkingStyle}
          isStreaming={isStreaming}
          theme={options.theme}
          screenReader={options.screenReader}
        />
      )}
      {options.showToolCalls &&
        toolCalls.map(call => <ToolCallBlock key={call.id} call={call} theme={options.theme} screenReader={options.screenReader} />)}
      <StreamingText
        text={text}
        markdown={options.markdown}
        isStreaming={isStreaming}
        theme={options.theme}
        screenReader={options.screenReader}
        syntaxHighlight={options.syntaxHighlight}
      />
    </Box>
  );
}

export default function InkStreamRenderer({
  stateRef,
  forceUpdateRef,
  setForceUpdate,
  options,
}: InkStreamRendererProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setForceUpdate(() => setTick(t => t + 1));
  }, [setForceUpdate]);

  // Suppress unused variable warning — forceUpdateRef is used by callers
  void forceUpdateRef;
  void tick;

  const renderOptions: RenderOptions = {
    showThinking: options.showThinking ?? true,
    thinkingStyle: options.thinkingStyle ?? 'blockquote',
    showToolCalls: options.showToolCalls ?? true,
    markdown: options.markdown ?? true,
    theme: options.theme,
    screenReader: options.screenReader ?? false,
    syntaxHighlight: options.syntaxHighlight ?? false,
  };

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
