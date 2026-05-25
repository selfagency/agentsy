import { Box, Text } from 'ink';

import type { AcidPalette } from '../../theme/palette.ts';

export interface TokenMeterProps {
  /** Input token count. */
  readonly input: number;
  /** Output token count (streamed so far). */
  readonly output: number;
  /** Total token count (or undefined if not tracked). */
  readonly total?: number;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Optional label override. */
  readonly label?: string;
}

/**
 * Live token count display — input / output / total.
 *
 * Renders as a compact status line: "in: 123 · out: 456 · total: 579"
 */
export function TokenMeter({ input, output, total, palette, label }: TokenMeterProps) {
  return (
    <Box>
      {label ? (
        <Text color={palette.frameDim} bold>
          {' '}
          {label}{' '}
        </Text>
      ) : null}
      <Text color={palette.frameDim}>{'in: '}</Text>
      <Text color={palette.emphasis}>{input.toLocaleString()}</Text>
      <Text color={palette.frameDim}>{' · out: '}</Text>
      <Text color={palette.assistantAccent}>{output.toLocaleString()}</Text>
      {total !== undefined ? (
        <>
          <Text color={palette.frameDim}>{' · total: '}</Text>
          <Text color={palette.info}>{total.toLocaleString()}</Text>
        </>
      ) : null}
    </Box>
  );
}
