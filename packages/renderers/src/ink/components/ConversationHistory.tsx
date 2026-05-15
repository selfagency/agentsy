import { Box, Static, Text } from 'ink';
import type { ConversationTurn } from '../createInkConversationRenderer.js';
import type { Theme } from '../themes/types.js';
import { StreamingText } from './StreamingText.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolCallBlock } from './ToolCallBlock.js';

interface ConversationHistoryProps {
  readonly turns: readonly ConversationTurn[];
  readonly theme: Theme;
  readonly screenReader?: boolean | undefined;
  readonly options: {
    readonly showThinking?: boolean | undefined;
    readonly thinkingStyle?: 'blockquote' | 'inline' | 'suppress' | undefined;
    readonly showToolCalls?: boolean | undefined;
    readonly markdown?: boolean | undefined;
    readonly syntaxHighlight?: boolean | undefined;
  };
}

export function ConversationHistory({ turns, theme, screenReader = false, options }: ConversationHistoryProps) {
  const {
    showThinking = true,
    thinkingStyle = 'blockquote',
    showToolCalls = true,
    markdown = true,
    syntaxHighlight = false
  } = options;

  return (
    <Static items={turns as ConversationTurn[]}>
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
