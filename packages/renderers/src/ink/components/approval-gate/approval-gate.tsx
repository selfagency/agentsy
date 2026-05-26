import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';

import type { AcidPalette } from '../../theme/palette.js';

export type ApprovalAction = 'approve' | 'reject' | 'edit';

export interface ApprovalGateProps {
  /** Title of the approval request. */
  readonly title: string;
  /** Description / detail of what needs approval. */
  readonly description: string;
  /** Optional code/command preview to show. */
  readonly preview?: string;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Called when user makes a choice. */
  readonly onAction: (action: ApprovalAction) => void;
  /** Whether this modal is visible/focused. */
  readonly isOpen?: boolean;
  /** Optional additional context content. */
  readonly children?: ReactNode;
}

/**
 * BBS-style approval gate modal.
 *
 * Renders a centered modal overlay for agent approval requests,
 * in the style of Mystic BBS's escape-menu popup:
 *
 *   ╔══════════════════════════════════════╗
 *   ║  ⚠  APPROVAL REQUIRED               ║
 *   ╠══════════════════════════════════════╣
 *   ║  Tool: bash                          ║
 *   ║  Command: rm -rf dist/               ║
 *   ║                                      ║
 *   ║  > rm -rf dist/                      ║
 *   ║                                      ║
 *   ╠══════════════════════════════════════╣
 *   ║  [A] Approve   [R] Reject   [E] Edit ║
 *   ╚══════════════════════════════════════╝
 *
 * Keyboard: A=approve, R=reject, E=edit, Escape=reject.
 * Aesthetic: Mystic BBS popup — double-border, warning header, hotkey strip.
 */
export function ApprovalGate({
  title,
  description,
  preview,
  palette,
  onAction,
  isOpen = true,
  children
}: ApprovalGateProps) {
  useInput(
    (input, key) => {
      const lower = input.toLowerCase();
      if (lower === 'a') {
        onAction('approve');
      } else if (lower === 'r' || key.escape) {
        onAction('reject');
      } else if (lower === 'e') {
        onAction('edit');
      }
    },
    { isActive: isOpen }
  );

  if (!isOpen) return null;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={palette.warning} paddingX={2} paddingY={1}>
      {/* Header */}
      <Box flexDirection="row" marginBottom={1}>
        <Text color={palette.warning} bold>
          {'⚠  APPROVAL REQUIRED'}
        </Text>
      </Box>

      {/* Title */}
      <Box marginBottom={0}>
        <Text color={palette.frameBright} bold>
          {title}
        </Text>
      </Box>

      {/* Description */}
      <Box marginBottom={preview ? 1 : 0}>
        <Text color={palette.muted}>{description}</Text>
      </Box>

      {/* Code preview */}
      {preview ? (
        <Box flexDirection="column" borderStyle="single" borderColor={palette.frameDim} paddingX={1} marginBottom={1}>
          <Text color={palette.assistantAccent}>
            {'> '}
            {preview}
          </Text>
        </Box>
      ) : null}

      {/* Additional content */}
      {children ? <Box marginBottom={1}>{children}</Box> : null}

      {/* Separator */}
      <Text color={palette.frameDim}>{'═'.repeat(36)}</Text>

      {/* Action strip */}
      <Box flexDirection="row" marginTop={1}>
        <Box marginRight={3}>
          <Text color={palette.success} bold>
            {'[A]'}
          </Text>
          <Text color={palette.frameBright}>{' Approve'}</Text>
        </Box>
        <Box marginRight={3}>
          <Text color={palette.error} bold>
            {'[R]'}
          </Text>
          <Text color={palette.frameBright}>{' Reject'}</Text>
        </Box>
        <Box>
          <Text color={palette.warning} bold>
            {'[E]'}
          </Text>
          <Text color={palette.frameBright}>{' Edit'}</Text>
        </Box>
        <Box flexGrow={1} />
        <Text color={palette.muted} dimColor>
          {'ESC=reject'}
        </Text>
      </Box>
    </Box>
  );
}
