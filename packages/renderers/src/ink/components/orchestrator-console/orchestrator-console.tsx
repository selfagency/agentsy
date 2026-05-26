import { Box, Text, useInput } from 'ink';

import type { AcidPalette } from '../../theme/palette.js';

export interface AgentConfig {
  /** Agent name/id. */
  readonly name: string;
  /** Model identifier. */
  readonly model: string;
  /** Session id. */
  readonly sessionId: string;
  /** Max tokens budget. */
  readonly maxTokens?: number;
  /** Current token usage. */
  readonly tokensUsed?: number;
  /** Agent status. */
  readonly status: 'idle' | 'running' | 'paused' | 'error';
  /** Active tool count. */
  readonly activeTools?: number;
}

export interface OrchestratorConsoleProps {
  /** Current agent configuration. */
  readonly agent: AgentConfig;
  /** Semantic palette. */
  readonly palette: AcidPalette;
  /** Called when model change is requested (M key). */
  readonly onModelChange?: () => void;
  /** Called when session reset is requested (R key). */
  readonly onReset?: () => void;
  /** Called when agent is paused/resumed (P key). */
  readonly onTogglePause?: () => void;
  /** Called when config is opened (C key). */
  readonly onConfig?: () => void;
  /** Whether this console is focused. */
  readonly isFocused?: boolean;
}

const STATUS_COLORS: Record<AgentConfig['status'], keyof AcidPalette> = {
  idle: 'muted',
  running: 'success',
  paused: 'warning',
  error: 'error'
};

const STATUS_LABELS: Record<AgentConfig['status'], string> = {
  idle: 'IDLE',
  running: 'RUNNING',
  paused: 'PAUSED',
  error: 'ERROR'
};

/**
 * BBS-style orchestrator / sysop console.
 *
 * Renders agent configuration and session controls in the style of
 * Mystic BBS's sysop console (the "C Configuration" modal):
 *
 *   ═Orchestrator══════════════════════════════════════
 *   Agent    : agent-name                  ● RUNNING
 *   Model    : claude-opus-4               [M] Change
 *   Session  : ses_abc123                  [R] Reset
 *   Tokens   : 12,847 / 100,000  ████░░░░  [P] Pause
 *   Tools    : 3 active                    [C] Config
 *   ───────────────────────────────────────────────────
 *   [M]odel  [R]eset  [P]ause  [C]onfig  [?]Help
 *
 * Aesthetic: Mystic BBS sysop panel — dense info rows, hotkey strip at bottom.
 */
export function OrchestratorConsole({
  agent,
  palette,
  onModelChange,
  onReset,
  onTogglePause,
  onConfig,
  isFocused = true
}: OrchestratorConsoleProps) {
  useInput(
    input => {
      const lower = input.toLowerCase();
      if (lower === 'm') onModelChange?.();
      else if (lower === 'r') onReset?.();
      else if (lower === 'p') onTogglePause?.();
      else if (lower === 'c') onConfig?.();
    },
    { isActive: isFocused }
  );

  const statusColorKey = STATUS_COLORS[agent.status] ?? 'muted';
  const statusColor = palette[statusColorKey] as string;
  const statusLabel = STATUS_LABELS[agent.status] ?? agent.status.toUpperCase();

  // Token progress bar
  const tokenBar = buildTokenBar(agent.tokensUsed, agent.maxTokens, palette);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text color={palette.frameBorder}>{'═'}</Text>
        <Text color={palette.frameBright} bold>
          {'Orchestrator'}
        </Text>
        <Text color={palette.frameBorder}>{'═'}</Text>
      </Box>

      {/* Agent row */}
      <Box flexDirection="row">
        <Text color={palette.muted}>{'Agent    : '}</Text>
        <Text color={palette.frameBright} bold>
          {agent.name}
        </Text>
        <Box flexGrow={1} />
        <Text color={statusColor} bold>
          {'● '}
          {statusLabel}
        </Text>
      </Box>

      {/* Model row */}
      <Box flexDirection="row">
        <Text color={palette.muted}>{'Model    : '}</Text>
        <Text color={palette.assistantAccent}>{agent.model}</Text>
        <Box flexGrow={1} />
        <Text color={palette.frameDim}>{'[M] Change'}</Text>
      </Box>

      {/* Session row */}
      <Box flexDirection="row">
        <Text color={palette.muted}>{'Session  : '}</Text>
        <Text color={palette.info}>{agent.sessionId}</Text>
        <Box flexGrow={1} />
        <Text color={palette.frameDim}>{'[R] Reset'}</Text>
      </Box>

      {/* Token usage row */}
      {agent.maxTokens !== undefined ? (
        <Box flexDirection="row">
          <Text color={palette.muted}>{'Tokens   : '}</Text>
          <Text color={palette.frameBright}>
            {(agent.tokensUsed ?? 0).toLocaleString()}
            {' / '}
            {agent.maxTokens.toLocaleString()}
          </Text>
          <Text color={palette.frameDim}>{'  '}</Text>
          <Text>{tokenBar}</Text>
          <Box flexGrow={1} />
          <Text color={palette.frameDim}>{'[P] Pause'}</Text>
        </Box>
      ) : null}

      {/* Active tools row */}
      {agent.activeTools !== undefined ? (
        <Box flexDirection="row">
          <Text color={palette.muted}>{'Tools    : '}</Text>
          <Text color={agent.activeTools > 0 ? palette.warning : palette.muted}>
            {agent.activeTools}
            {' active'}
          </Text>
          <Box flexGrow={1} />
          <Text color={palette.frameDim}>{'[C] Config'}</Text>
        </Box>
      ) : null}

      {/* Separator */}
      <Text color={palette.frameDim}>{'─'.repeat(40)}</Text>

      {/* Hotkey strip */}
      <Box flexDirection="row" flexWrap="wrap">
        {[
          { key: 'M', label: 'odel' },
          { key: 'R', label: 'eset' },
          { key: 'P', label: 'ause' },
          { key: 'C', label: 'onfig' }
        ].map((cmd, i) => (
          <Box key={cmd.key} marginRight={i < 3 ? 2 : 0}>
            <Text color={palette.assistantAccent} bold>
              {'['}
              {cmd.key}
              {']'}
            </Text>
            <Text color={palette.frameBright}>{cmd.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function buildTokenBar(used: number | undefined, max: number | undefined, palette: AcidPalette): string {
  if (used === undefined || max === undefined || max === 0) return '';
  const pct = Math.min(1, used / max);
  const width = 8;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const fillColor = pct > 0.8 ? palette.error : pct > 0.5 ? palette.warning : palette.success;
  // Return plain string — color applied by caller if needed
  void fillColor;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
