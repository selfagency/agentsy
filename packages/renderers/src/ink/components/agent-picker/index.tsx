import { Box, Text } from 'ink';

import type { AcidPalette } from '../../theme/palette.ts';
import { SearchInput } from '../model-picker/search-input.tsx';

export type AgentProvenance = 'bundled' | 'user' | 'workspace' | 'plugin';

export interface AgentEntry {
  /** Whether this agent is currently active. */
  readonly active: boolean;
  /** Short description. */
  readonly description: string;
  /** Agent identifier (e.g. "superagents/research"). */
  readonly id: string;
  /** Preferred model (if specified). */
  readonly model?: string;
  /** Display name. */
  readonly name: string;
  /** Where this agent came from. */
  readonly provenance: AgentProvenance;
  /** Number of tools available. */
  readonly toolCount?: number;
}

export interface AgentPickerProps {
  /** Available agents. */
  readonly agents: readonly AgentEntry[];
  /** Whether the component is focused. */
  readonly focused?: boolean;
  /** Current highlight index for keyboard nav. */
  readonly highlightIndex: number;
  /** Callback when query changes. */
  readonly onQueryChange?: (query: string) => void;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Current search query. */
  readonly query: string;
}

const provenanceTokens: Record<AgentProvenance, { label: string; color: keyof AcidPalette }> = {
  bundled: { label: 'built-in', color: 'info' },
  user: { label: 'user', color: 'success' },
  workspace: { label: 'project', color: 'warning' },
  plugin: { label: 'plugin', color: 'pending' }
};

/**
 * Searchable agent list with provenance badges.
 *
 * Arrow-key navigation to browse available agents, with
 * model preference and tool access summary per agent.
 */
export function AgentPicker({ agents, query, highlightIndex, palette, focused = true }: AgentPickerProps) {
  const filtered =
    query.length > 0
      ? agents.filter(
          a =>
            a.name.toLowerCase().includes(query.toLowerCase()) ||
            a.description.toLowerCase().includes(query.toLowerCase())
        )
      : agents;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Search header */}
      <Box marginBottom={1}>
        <SearchInput focused={focused} palette={palette} placeholder="Search agents…" query={query} />
      </Box>

      {/* Agent list */}
      {filtered.length === 0 ? (
        <Box>
          <Text color={palette.muted}>No agents match "{query}"</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: refactor planned */}
          {filtered.map((agent, idx) => {
            const isHighlighted = idx === highlightIndex;
            const provenance = provenanceTokens[agent.provenance];
            const arrow = isHighlighted ? '▸' : ' ';
            const activeMark = agent.active ? '●' : '○';

            return (
              <Box flexDirection="column" key={agent.id}>
                <Box>
                  <Text color={palette.assistantAccent}>{arrow} </Text>
                  <Text
                    bold={isHighlighted || agent.active}
                    color={isHighlighted ? palette.emphasis : palette.frameBright}
                  >
                    {agent.name}
                  </Text>
                  <Text color={palette[provenance.color]}>
                    {' ['}
                    {provenance.label}
                    {']'}
                  </Text>
                </Box>

                <Box marginLeft={3}>
                  <Text color={palette.assistantDim} dimColor>
                    {agent.description}
                  </Text>
                </Box>

                <Box marginLeft={3}>
                  <Text color={palette.frameDim}>
                    {activeMark} {agent.active ? 'active' : 'inactive'}
                  </Text>
                  {agent.model ? <Text color={palette.frameDim}>{' · model: '}</Text> : null}
                  {agent.model ? <Text color={palette.info}>{agent.model}</Text> : null}
                  {agent.toolCount === undefined ? null : (
                    <Text color={palette.frameDim}>
                      {' · '}
                      {agent.toolCount} tool{agent.toolCount === 1 ? '' : 's'}
                    </Text>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
