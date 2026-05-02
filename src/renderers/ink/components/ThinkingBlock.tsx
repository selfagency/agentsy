import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import type { Theme } from '../themes/types.js';

interface ThinkingBlockProps {
  text: string;
  style: 'blockquote' | 'inline' | 'suppress';
  isStreaming: boolean;
  theme: Theme;
  screenReader?: boolean;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function ThinkingBlock({ text, style, isStreaming, theme, screenReader = false }: ThinkingBlockProps) {
  const [frame, setFrame] = useState(0);
  const spinnerInterval = theme.thinking.spinnerIntervalMs ?? 80;

  useEffect(() => {
    if (style === 'blockquote' && isStreaming && !screenReader) {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % spinnerFrames.length);
      }, spinnerInterval);
      return () => clearInterval(interval);
    }
  }, [style, isStreaming, screenReader, spinnerInterval]);

  if (style === 'suppress') {
    return null;
  }

  if (style === 'inline') {
    if (screenReader) {
      return <Text>Thinking: {text}</Text>;
    }
    const textColor = theme.thinking.textColor || undefined;
    return (
      <Text italic dimColor={theme.text.dimColor} {...(textColor ? { color: textColor } : {})}>
        [Thinking] {text}
        {isStreaming && '…'}
      </Text>
    );
  }

  if (screenReader) {
    return <Text>{'\nThinking:\n' + text + '\n'}</Text>;
  }

  const borderStyle = theme.border.style !== 'none' ? (theme.border.style as 'single' | 'double' | 'round') : undefined;
  const borderColor = theme.border.color || undefined;
  const spinnerSymbol = spinnerFrames[frame] ?? spinnerFrames[0];
  const spinnerColor = isStreaming ? theme.thinking.spinnerColor || undefined : theme.thinking.textColor || undefined;

  return (
    <Box borderStyle={borderStyle} {...(borderColor ? { borderColor } : {})} paddingLeft={1} marginBottom={1}>
      <Text {...(spinnerColor ? { color: spinnerColor } : {})}>
        {isStreaming ? spinnerSymbol + ' thinking…' : text}
      </Text>
    </Box>
  );
}
