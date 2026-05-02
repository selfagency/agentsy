import { Box, Static, Text } from 'ink';
import type { ConversationTurn } from '../createInkConversationRenderer.js';
import type { Theme } from '../themes/types.js';
import { StreamingText } from './StreamingText.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolCallBlock } from './ToolCallBlock.js';

interface ConversationHistoryProps {
  turns: ConversationTurn[];
  theme: Theme;
  screenReader?: boolean | undefined;
  options: {
    showThinking?: boolean | undefined;
    thinkingStyle?: 'blockquote' | 'inline' | 'suppress' | undefined;
    showToolCalls?: boolean | undefined;
    markdown?: boolean | undefined;
    syntaxHighlight?: boolean | undefined;
  };
}

export function ConversationHistory({ turns, theme, screenReader = false, options }: ConversationHistoryProps) {
  const {
    showThinking = true,
    thinkingStyle = 'blockquote',
    showToolCalls = true,
    markdown = true,
    syntaxHighlight = false,
  } = options;

  return (
    <Static items={turns}>
      {turn => (
        <Box key={turn.id} flexDirection="column" marginBottom={1}>
          {turn.role === 'user' ? (
            <Text bold>{`› ${turn.text}`}</Text>
          ) : (
            <Box flexDirection="column">
              {showThinking && turn.thinking && (
                <ThinkingBlock
                  text={turn.thinking}
                  style={thinkingStyle}
                  isStreaming={false}
                  theme={theme}
                  screenReader={screenReader}
                />
              )}
              {showToolCalls &&
                turn.toolCalls.map(call => (
                  <ToolCallBlock key={call.id} call={call} theme={theme} screenReader={screenReader} />
                ))}
              <StreamingText
                text={turn.text}
                markdown={markdown}
                isStreaming={false}
                theme={theme}
                screenReader={screenReader}
                syntaxHighlight={syntaxHighlight}
              />
            </Box>
          )}
        </Box>
      )}
    </Static>
  );
}
