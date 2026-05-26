import { Box } from 'ink';

import type { AcidPalette } from '../../theme/palette.ts';
import { FramedPanel } from '../framed-panel.tsx';
import { MessageBubble } from './message-bubble.tsx';
import { StatusFooter, type ConnectionStatus } from './status-footer.tsx';
import { StreamingCursor } from './streaming-cursor.tsx';
import { TokenMeter } from './token-meter.tsx';

export interface TranscriptTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly text: string;
  readonly timestamp?: string;
  readonly dim?: boolean;
}

export interface TranscriptProps {
  /** Ordered list of conversation turns. */
  readonly turns: readonly TranscriptTurn[];
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Whether streaming is in progress. */
  readonly isStreaming: boolean;
  /** Active model name. */
  readonly modelName?: string;
  /** Provider name. */
  readonly provider?: string;
  /** Current connection status. */
  readonly status: ConnectionStatus;
  /** Elapsed time in seconds. */
  readonly elapsedSec?: number;
  /** Input token count. */
  readonly inputTokens?: number;
  /** Output token count. */
  readonly outputTokens?: number;
  /** Cursor symbol while streaming. */
  readonly cursorSymbol?: string;
}

/**
 * BBS-framed conversation transcript — wraps chat turns inside
 * a heavy box-drawing panel with a CONVERSATION title bar.
 */
export function Transcript({
  turns,
  palette,
  isStreaming,
  modelName,
  provider,
  status,
  elapsedSec,
  inputTokens = 0,
  outputTokens = 0,
  cursorSymbol
}: TranscriptProps) {
  return (
    <FramedPanel title="CONVERSATION" palette={palette} showTitleSeparator={true}>
      <Box flexDirection="column" paddingX={1}>
        {/* Conversation turns */}
        {turns.map(turn => (
          <MessageBubble
            key={turn.id}
            text={turn.text}
            role={turn.role}
            palette={palette}
            {...(turn.timestamp !== undefined ? { timestamp: turn.timestamp } : {})}
            {...(turn.dim !== undefined ? { dim: turn.dim } : {})}
          />
        ))}

        {/* Streaming cursor */}
        {isStreaming ? (
          <Box marginBottom={1}>
            <StreamingCursor
              color={palette.assistantAccent}
              isStreaming={isStreaming}
              {...(cursorSymbol !== undefined ? { symbol: cursorSymbol } : {})}
            />
          </Box>
        ) : null}

        {/* Token meter */}
        {inputTokens > 0 || outputTokens > 0 ? (
          <TokenMeter input={inputTokens} output={outputTokens} palette={palette} />
        ) : null}

        {/* Status footer */}
        <StatusFooter
          status={status}
          palette={palette}
          {...(modelName !== undefined ? { modelName } : {})}
          {...(elapsedSec !== undefined ? { elapsedSec } : {})}
          {...(provider !== undefined ? { provider } : {})}
        />
      </Box>
    </FramedPanel>
  );
}
