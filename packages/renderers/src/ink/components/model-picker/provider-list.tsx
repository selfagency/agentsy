import { Box, Text } from 'ink';

import type { AcidPalette } from '../../theme/palette.ts';

export interface ProviderEntry {
  /** Provider identifier (e.g. "anthropic"). */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Available capability tags. */
  readonly capabilities: readonly string[];
  /** Whether this provider is currently selected. */
  readonly selected: boolean;
}

export interface ProviderListProps {
  /** List of available providers. */
  readonly providers: readonly ProviderEntry[];
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Currently highlighted index. */
  readonly highlightIndex: number;
}

/**
 * Filterable provider list with capability badges.
 */
export function ProviderList({ providers, palette, highlightIndex }: ProviderListProps) {
  if (providers.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={palette.muted}>No providers found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {providers.map((provider, idx) => {
        const isHighlighted = idx === highlightIndex;
        const arrow = isHighlighted ? '▸' : ' ';
        const nameColor = provider.selected ? palette.success : isHighlighted ? palette.emphasis : palette.frameBright;

        return (
          <Box key={provider.id}>
            <Text color={palette.assistantAccent}>{arrow} </Text>
            <Text color={nameColor} bold={isHighlighted}>
              {provider.name}
            </Text>
            {provider.capabilities.length > 0 ? (
              <Box marginLeft={1}>
                {provider.capabilities.map(cap => (
                  <Text key={cap} color={palette.info}>
                    {' ['}
                    {cap}
                    {']'}
                  </Text>
                ))}
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
