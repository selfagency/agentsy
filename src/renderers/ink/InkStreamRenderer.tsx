import { Box } from 'ink';
import { useEffect, useState } from 'react';
import type { KeyboardOptions } from './components/KeyboardHandler.js';
import { KeyboardHandler } from './components/KeyboardHandler.js';
import { StreamingText } from './components/StreamingText.js';
import { ThinkingBlock } from './components/ThinkingBlock.js';
import { ToolCallBlock } from './components/ToolCallBlock.js';
import type { Theme } from './themes/types.js';

interface InkStreamRendererProps {
  stateRef: {
    text: string;
    thinking: string;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown>; done: boolean }>;
    isStreaming: boolean;
  };
  forceUpdateRef: { current: () => void };
  setForceUpdate: (fn: () => void) => void;
  options: {
    showThinking?: boolean | undefined;
    thinkingStyle?: 'blockquote' | 'inline' | 'suppress' | undefined;
    showToolCalls?: boolean | undefined;
    markdown?: boolean | undefined;
    theme: Theme;
    screenReader?: boolean | undefined;
    syntaxHighlight?: boolean | undefined;
    keyboard?: KeyboardOptions | undefined;
  };
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

  const { text, thinking, toolCalls, isStreaming } = stateRef;

  const {
    showThinking = true,
    thinkingStyle = 'blockquote',
    showToolCalls = true,
    markdown = true,
    theme,
    screenReader = false,
    syntaxHighlight = false,
    keyboard,
  } = options;

  return (
    <Box flexDirection="column">
      {showThinking && thinking && (
        <ThinkingBlock
          text={thinking}
          style={thinkingStyle}
          isStreaming={isStreaming}
          theme={theme}
          screenReader={screenReader}
        />
      )}
      {showToolCalls &&
        toolCalls.map(call => <ToolCallBlock key={call.id} call={call} theme={theme} screenReader={screenReader} />)}
      <StreamingText
        text={text}
        markdown={markdown}
        isStreaming={isStreaming}
        theme={theme}
        screenReader={screenReader}
        syntaxHighlight={syntaxHighlight}
      />
      {keyboard?.enabled === true && <KeyboardHandler keyboard={keyboard} />}
    </Box>
  );
}
