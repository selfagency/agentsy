import { Text } from 'ink';
import { useEffect, useState } from 'react';
import type { Theme } from '../themes/types.js';

interface ToolCallBlockProps {
  readonly call: { readonly id: string; readonly name: string; readonly arguments: Record<string, unknown>; readonly done: boolean };
  readonly theme: Theme;
  readonly screenReader?: boolean;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function ToolCallBlock({ call, theme, screenReader = false }: ToolCallBlockProps) {
  const [frame, setFrame] = useState(0);
  const spinnerInterval = theme.toolCall.spinnerIntervalMs ?? 80;

  const shouldAnimate = !screenReader && !!theme.toolCall.pendingColor;

  useEffect(() => {
    if (!call.done && shouldAnimate) {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % spinnerFrames.length);
      }, spinnerInterval);
      return () => clearInterval(interval);
    }
  }, [call.done, shouldAnimate, spinnerInterval]);

  if (call.done) {
    if (screenReader) {
      return <Text>Done: {call.name}</Text>;
    }
    const doneColor = theme.toolCall.doneColor || undefined;
    return (
      <Text {...(doneColor ? { color: doneColor } : {})}>
        {theme.toolCall.doneSymbol} {call.name}
      </Text>
    );
  }

  if (screenReader) {
    return <Text>Calling: {call.name}(...)</Text>;
  }

  const symbol = shouldAnimate ? (spinnerFrames[frame] ?? spinnerFrames[0]) : theme.toolCall.pendingSymbol;
  const pendingColor = theme.toolCall.pendingColor || undefined;
  return (
    <Text {...(pendingColor ? { color: pendingColor } : {})}>
      {symbol} {call.name}(…)
    </Text>
  );
}
