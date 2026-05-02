import { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

interface ThinkingBlockProps {
  text: string;
  style: 'blockquote' | 'inline' | 'suppress';
  isStreaming: boolean;
}

const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function ThinkingBlock({ text, style, isStreaming }: ThinkingBlockProps) {
  if (style === 'suppress') {
    return null as React.ReactNode;
  }

  if (style === 'inline') {
    return (
      <Text italic dimColor>
        [Thinking] {text}
        {isStreaming && '…'}
      </Text>
    );
  }

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % spinner.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <Box borderStyle="single" paddingLeft={1} marginBottom={1}>
      <Text color="gray">│ {isStreaming ? spinner[frame] + ' thinking…' : text}</Text>
    </Box>
  );
}
