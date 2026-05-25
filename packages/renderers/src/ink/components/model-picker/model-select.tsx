import { Box, Text } from 'ink';

import { inkBorderStyle } from '../../theme/frames.ts';
import type { AcidPalette } from '../../theme/palette.ts';

export interface ModelEntry {
  /** Model identifier (e.g. "claude-sonnet-4-20250514"). */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Model capabilities. */
  readonly capabilities: readonly string[];
  /** Context window size. */
  readonly contextWindow?: number;
  /** Provider name this model belongs to. */
  readonly provider: string;
  /** Whether model supports streaming. */
  readonly supportsStreaming?: boolean;
}

export interface ModelSelectProps {
  /** Available models. */
  readonly models: readonly ModelEntry[];
  /** Currently selected model ID. */
  readonly selectedId?: string;
  /** Highlighted index for keyboard navigation. */
  readonly highlightIndex: number;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Whether scope is local or cloud. */
  readonly scope?: 'local' | 'cloud';
  /** Scope toggle handler label. */
  readonly scopeLabel?: string;
}

/**
 * Model selection list with capability details and scope toggle.
 *
 * Shows each model with name, context window, streaming support,
 * and capability badges. Arrow-key navigable.
 */
export function ModelSelect({
  models,
  selectedId,
  highlightIndex,
  palette,
  scope = 'cloud',
  scopeLabel
}: ModelSelectProps) {
  if (models.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={palette.muted}>No models available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Scope indicator */}
      <Box paddingX={1} marginBottom={1}>
        <Text color={palette.frameDim}>scope: </Text>
        <Text color={scope === 'cloud' ? palette.info : palette.success} bold>
          {scope}
        </Text>
        {scopeLabel ? <Text color={palette.muted}> ({scopeLabel})</Text> : null}
      </Box>

      {/* Model list */}
      {models.map((model, idx) => {
        const isSelected = model.id === selectedId;
        const isHighlighted = idx === highlightIndex;
        const arrow = isHighlighted ? '▸' : ' ';
        const nameColor = isSelected ? palette.success : isHighlighted ? palette.emphasis : palette.assistantText;

        return (
          <Box key={model.id} paddingX={1}>
            <Text color={palette.assistantAccent}>{arrow} </Text>
            <Text color={nameColor} bold={isHighlighted || isSelected}>
              {model.name}
            </Text>

            {/* Context window badge */}
            {model.contextWindow ? (
              <Text color={palette.frameDim}> {model.contextWindow.toLocaleString()} ctx</Text>
            ) : null}

            {/* Streaming badge */}
            {model.supportsStreaming === false ? <Text color={palette.warning}> no-stream</Text> : null}

            {/* Capability badges */}
            {model.capabilities.map(cap => (
              <Text key={cap} color={palette.info}>
                {' ['}
                {cap}
                {']'}
              </Text>
            ))}

            {/* Selection indicator */}
            {isSelected ? <Text color={palette.success}> ✓</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
