import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';

import { animationInterval, spinnerFrames, reducedMotion } from '../../theme/motion.ts';
import type { AcidPalette } from '../../theme/palette.ts';

export interface StreamThinkingBlockProps {
  /** Thinking text content. */
  readonly text: string;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Whether thinking is still in progress. */
  readonly isInProgress: boolean;
  /** Whether to expand the thinking block. */
  readonly expanded?: boolean;
  /** Toggle expand/collapse handler. */
  onToggle?: () => void;
}

const thinkingSpinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Expandable/collapsible thinking block.
 *
 * When collapsed: shows a single-line spinner with "[thinking…]".
 * When expanded: shows the full thinking content in dim ANSI.
 * Respects reduced-motion: static indicator when animation disabled.
 */
export function StreamThinkingBlock({
  text,
  palette,
  isInProgress,
  expanded = false,
  onToggle
}: StreamThinkingBlockProps) {
  const [frame, setFrame] = useState(0);
  const frames = spinnerFrames(thinkingSpinner);

  useEffect(() => {
    if (!isInProgress || reducedMotion()) {
      return;
    }
    const interval = setInterval(() => setFrame(f => (f + 1) % frames.length), animationInterval(80, 1000));
    return () => {
      clearInterval(interval);
    };
  }, [isInProgress, frames.length]);

  const spinner = frames[frame] ?? '⠋';
  const borderColor = palette.assistantDim;
  const borderStyleVal = 'bold' as const;

  if (!expanded) {
    return (
      <Box borderStyle={borderStyleVal} borderColor={borderColor} paddingX={1} marginBottom={1}>
        <Text color={palette.pending}>{isInProgress ? `${spinner} thinking…` : '◈ thinking complete'}</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle={borderStyleVal} borderColor={borderColor} paddingX={1} marginBottom={1} flexDirection="column">
      <Text color={palette.pending} bold>
        {isInProgress ? `${spinner} thinking…` : '◈ thinking'}
      </Text>
      <Text color={palette.assistantDim} dimColor>
        {text}
      </Text>
    </Box>
  );
}
