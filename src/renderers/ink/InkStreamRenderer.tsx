import { useState, useEffect } from 'react';
import { Box } from 'ink';
import { ThinkingBlock } from './components/ThinkingBlock.js';
import { ToolCallBlock } from './components/ToolCallBlock.js';
import { StreamingText } from './components/StreamingText.js';

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
    showThinking?: boolean;
    thinkingStyle?: 'blockquote' | 'inline' | 'suppress';
    showToolCalls?: boolean;
    markdown?: boolean;
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

  const { text, thinking, toolCalls, isStreaming } = stateRef;

  const { showThinking = true, thinkingStyle = 'blockquote', showToolCalls = true, markdown = true } = options;

  return (
    <Box flexDirection="column">
      {showThinking && thinking && <ThinkingBlock text={thinking} style={thinkingStyle} isStreaming={isStreaming} />}
      {showToolCalls && toolCalls.map(call => <ToolCallBlock key={call.id} call={call} />)}
      <StreamingText text={text} markdown={markdown} isStreaming={isStreaming} />
    </Box>
  );
}
