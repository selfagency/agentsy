import { useState, useEffect } from 'react';
import { Text } from 'ink';

interface ToolCallBlockProps {
  call: { id: string; name: string; arguments: Record<string, unknown>; done: boolean };
}

const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function ToolCallBlock({ call }: ToolCallBlockProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (call.done === false) {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % spinner.length);
      }, 80);
      return () => clearInterval(interval);
    }
  }, [call.done]);

  if (call.done === false) {
    return (
      <Text color="yellow">
        {spinner[frame]} {call.name}(…)
      </Text>
    );
  }

  return <Text color="green">✓ {call.name}</Text>;
}
