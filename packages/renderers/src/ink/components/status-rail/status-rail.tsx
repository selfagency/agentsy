import { Box, Text } from 'ink';

import type { AcidPalette } from '../../theme/palette.js';

export interface StatusSegment {
  /** Segment label/value. */
  readonly text: string;
  /** Optional color override. Defaults to palette.frameBright. */
  readonly color?: string;
  /** Whether to bold this segment. */
  readonly bold?: boolean;
  /** Separator after this segment (default '│'). Set to '' to suppress. */
  readonly separator?: string;
}

export interface StatusRailProps {
  /** Left-side segments (mode, context, agent name). */
  readonly left: readonly StatusSegment[];
  /** Right-side segments (time, node, connection). */
  readonly right?: readonly StatusSegment[];
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Optional prompt text shown at far left (e.g. 'MAIN MENU'). */
  readonly mode?: string;
}

/**
 * BBS-style bottom status rail.
 *
 * Renders a dense single-line status bar in the style of Cave BBS / Piranha:
 *
 *   [AGENT] agent-name @ workspace — task description  │  12:34:56 │ node 1
 *
 * Left segments: mode bracket, context info, current task.
 * Right segments: time, session info, connection status.
 * Separator: │ between segments.
 */
export function StatusRail({ left, right = [], palette, mode }: StatusRailProps) {
  return (
    <Box flexDirection="row" borderStyle="single" borderColor={palette.frameBorder} paddingX={1}>
      {/* Mode bracket — [AGENT] */}
      {mode ? (
        <Box marginRight={1}>
          <Text color={palette.assistantAccent} bold>
            {'['}
            {mode}
            {']'}
          </Text>
        </Box>
      ) : null}

      {/* Left segments */}
      {left.map((seg, i) => (
        <Box key={i} flexDirection="row">
          <Text color={seg.color ?? palette.frameBright} {...(seg.bold ? { bold: true } : {})}>
            {seg.text}
          </Text>
          {(seg.separator ?? '│') !== '' ? <Text color={palette.frameDim}> {seg.separator ?? '│'} </Text> : null}
        </Box>
      ))}

      {/* Spacer pushes right segments to the right */}
      <Box flexGrow={1} />

      {/* Right segments */}
      {right.map((seg, i) => (
        <Box key={i} flexDirection="row">
          {i > 0 ? <Text color={palette.frameDim}>{' │ '}</Text> : null}
          <Text color={seg.color ?? palette.muted} {...(seg.bold ? { bold: true } : {})}>
            {seg.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
