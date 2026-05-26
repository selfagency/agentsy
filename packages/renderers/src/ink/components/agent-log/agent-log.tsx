import { Box, Static, Text } from 'ink';

import type { AcidPalette } from '../../theme/palette.js';

export type LogEventKind =
  | 'tool-call'
  | 'tool-result'
  | 'decision'
  | 'error'
  | 'warning'
  | 'info'
  | 'agent-start'
  | 'agent-done'
  | 'approval-request'
  | 'approval-granted'
  | 'approval-rejected';

export interface LogEvent {
  /** Unique event id. */
  readonly id: string;
  /** Event kind — affects icon and color. */
  readonly kind: LogEventKind;
  /** Timestamp string (e.g. '12:43p'). */
  readonly timestamp: string;
  /** Source label (e.g. 'TOOL', 'AGENT', 'SYSTEM'). */
  readonly source: string;
  /** Event message. */
  readonly message: string;
  /** Optional detail (truncated, shown dimmed). */
  readonly detail?: string;
}

export interface AgentLogProps {
  /** Log events to display. */
  readonly events: readonly LogEvent[];
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Max visible rows (default 20). */
  readonly maxRows?: number;
}

const KIND_ICONS: Record<LogEventKind, string> = {
  'tool-call': '→',
  'tool-result': '←',
  decision: '◆',
  error: '✗',
  warning: '⚠',
  info: '·',
  'agent-start': '▶',
  'agent-done': '■',
  'approval-request': '?',
  'approval-granted': '✓',
  'approval-rejected': '✗'
};

const KIND_COLORS: Record<LogEventKind, keyof AcidPalette> = {
  'tool-call': 'assistantAccent',
  'tool-result': 'success',
  decision: 'warning',
  error: 'error',
  warning: 'warning',
  info: 'muted',
  'agent-start': 'success',
  'agent-done': 'frameBright',
  'approval-request': 'warning',
  'approval-granted': 'success',
  'approval-rejected': 'error'
};

/**
 * BBS-style agent event log.
 *
 * Renders a dense, scrollable event list in the style of Mystic BBS's
 * system log / Cave BBS message list:
 *
 *   ═Agent Log══════════════════════════════════════════
 *   12:43p  TOOL    → read_file src/index.ts
 *   12:43p  TOOL    ← 847 bytes returned
 *   12:43p  AGENT   ◆ Decided to refactor exports
 *   12:43p  SYSTEM  ▶ Agent session started
 *   12:43p  TOOL    ✗ Error: file not found
 *
 * Uses Ink's <Static> for already-rendered events (no re-render on scroll).
 * Most recent events appear at the bottom.
 */
export function AgentLog({ events, palette, maxRows = 20 }: AgentLogProps) {
  const visible = events.slice(-maxRows);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={0}>
        <Text color={palette.frameBorder}>{'═'}</Text>
        <Text color={palette.frameBright} bold>
          {'Agent Log'}
        </Text>
        <Text color={palette.frameBorder}>{'═'}</Text>
        <Box flexGrow={1} />
        <Text color={palette.muted} dimColor>
          {events.length}
          {' events'}
        </Text>
      </Box>

      {/* Log rows — Static prevents re-render of settled events */}
      <Static items={visible}>{event => <LogRow key={event.id} event={event} palette={palette} />}</Static>
    </Box>
  );
}

interface LogRowProps {
  readonly event: LogEvent;
  readonly palette: AcidPalette;
}

function LogRow({ event, palette }: LogRowProps) {
  const colorKey = KIND_COLORS[event.kind] ?? 'frameBright';
  const color = palette[colorKey] as string;
  const icon = KIND_ICONS[event.kind] ?? '·';

  return (
    <Box flexDirection="row">
      {/* Timestamp */}
      <Text color={palette.muted} dimColor>
        {event.timestamp}
        {'  '}
      </Text>
      {/* Source label — fixed 7-char column */}
      <Text color={palette.frameBright} bold>
        {event.source.padEnd(7).slice(0, 7)}
      </Text>
      <Text color={palette.frameDim}>{'  '}</Text>
      {/* Icon */}
      <Text color={color} bold>
        {icon}{' '}
      </Text>
      {/* Message */}
      <Text color={color}>{event.message}</Text>
      {/* Detail */}
      {event.detail ? (
        <Text color={palette.muted} dimColor>
          {'  '}
          {event.detail}
        </Text>
      ) : null}
    </Box>
  );
}
