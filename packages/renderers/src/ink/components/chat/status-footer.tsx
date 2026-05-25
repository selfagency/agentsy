import { Box, Text } from 'ink';

import { reducedMotion } from '../../theme/motion.ts';
import type { AcidPalette } from '../../theme/palette.ts';

export type ConnectionStatus = 'connecting' | 'connected' | 'streaming' | 'idle' | 'error';

export interface StatusFooterProps {
  /** Current connection/streaming status. */
  readonly status: ConnectionStatus;
  /** Active model name (e.g. "claude-sonnet-4"). */
  readonly modelName?: string;
  /** Elapsed time in seconds. */
  readonly elapsedSec?: number;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Provider name (e.g. "anthropic", "openai"). */
  readonly provider?: string;
}

const statusSymbols: Record<ConnectionStatus, string> = {
  connecting: '◇',
  connected: '◇',
  streaming: '◈',
  idle: '○',
  error: '⊘'
};

const statusColors: Record<ConnectionStatus, keyof AcidPalette> = {
  connecting: 'info',
  connected: 'success',
  streaming: 'assistantAccent',
  idle: 'muted',
  error: 'error'
};

/**
 * Status footer — connection status, model name, elapsed time.
 *
 * Renders as a single-line footer at the bottom of the chat area.
 */
export function StatusFooter({ status, modelName, elapsedSec, palette, provider }: StatusFooterProps) {
  const statusKey = statusColors[status];
  const color = palette[statusKey];

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const parts: string[] = [];

  const symbol = reducedMotion() ? '●' : statusSymbols[status];

  return (
    <Box>
      <Text color={color}> {symbol} </Text>
      <Text color={palette.frameDim}>{status}</Text>
      {modelName ? (
        <>
          <Text color={palette.frameDim}> · </Text>
          <Text color={palette.assistantText}>{modelName}</Text>
        </>
      ) : null}
      {provider ? (
        <>
          <Text color={palette.frameDim}> via </Text>
          <Text color={palette.info}>{provider}</Text>
        </>
      ) : null}
      {elapsedSec !== undefined ? (
        <>
          <Text color={palette.frameDim}> · </Text>
          <Text color={palette.frameBright}>{formatTime(elapsedSec)}</Text>
        </>
      ) : null}
    </Box>
  );
}
