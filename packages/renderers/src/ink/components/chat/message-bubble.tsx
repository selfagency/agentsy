import { Box, Text } from 'ink';

import type { AcidPalette } from '../../theme/palette.ts';

export interface MessageBubbleProps {
  /** Message content text. */
  readonly text: string;
  /** Message role — determines alignment and colour. */
  readonly role: 'user' | 'assistant' | 'system';
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Optional timestamp string (e.g. "12:34:56"). */
  readonly timestamp?: string;
  /** Whether to dim the text (e.g., for thinking/metadata). */
  readonly dim?: boolean;
}

/**
 * Individual message bubble — user right-aligned (green), assistant left-aligned (cyan).
 */
export function MessageBubble({ text, role, palette, timestamp, dim = false }: MessageBubbleProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  const textColor = isSystem ? palette.warning : isUser ? palette.userText : palette.assistantText;

  return (
    <Box flexDirection="column" alignItems={isUser ? 'flex-end' : 'flex-start'} marginBottom={1}>
      {/* Role label */}
      <Box>
        <Text color={textColor} bold>
          {isUser ? '▸ you' : isSystem ? '◆ system' : '◈ assistant'}
        </Text>
        {timestamp ? <Text color={palette.frameDim}> {timestamp}</Text> : null}
      </Box>

      {/* Bubble content — BBS heavy box-drawing */}
      <Box borderStyle="bold" borderColor={textColor} paddingX={1} marginTop={0} flexDirection="column">
        <Text color={textColor} dimColor={dim}>
          {text}
        </Text>
      </Box>
    </Box>
  );
}
