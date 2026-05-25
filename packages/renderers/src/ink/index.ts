// fallow-ignore-file unused-file

/**
 * Ink renderer module - streaming React/Ink renderer for terminal output
 */

/* ── Existing components ────────────────────────────────────────── */
export type { KeyboardOptions } from './components/keyboard-handler.js';
export { createInkRuntimeController, loadInkRenderModules } from './ink-runtime-state.js';
export {
  createInkConversationRenderer,
  type ConversationTurn,
  type InkConversationRendererHandle,
  type InkConversationRendererOptions
} from './create-ink-conversation-renderer.js';
export { createInkRenderer, type InkRendererHandle, type InkRendererOptions } from './create-ink-renderer.ts';

/* ── Existing themes ─────────────────────────────────────────────── */
export {
  ayuMirageTheme,
  catppuccinFrappeTheme,
  catppuccinLatteTheme,
  catppuccinMacchiatoTheme,
  catppuccinMochaTheme,
  darkTheme,
  defaultTheme,
  draculaTheme,
  githubDarkTheme,
  houstonTheme,
  lightTheme,
  minimalTheme,
  oneCandyTheme,
  oneDarkTheme,
  resolveTheme,
  type ThemeName
} from './themes/index.js';
export type { BorderTheme, HighlightTheme, TextTheme, Theme, ThinkingTheme, ToolCallTheme } from './themes/types.js';

/* ── Acid ANSI BBS theme system (TASK-089) ──────────────────────────── */
export {
  type AcidPalette,
  defaultAcidPalette,
  highContrastAcidPalette,
  monochromeAcidPalette
} from './theme/palette.ts';
export {
  type FrameStyle,
  type FrameStyleName,
  type BorderConfig,
  frameStyles,
  topBorder,
  bottomBorder,
  separatorLine,
  inkBorderStyle,
  inkBorderColor,
  resolveBorderConfig
} from './theme/frames.ts';
export {
  type AsciiBanner,
  createBanner,
  agentsyBanner,
  agentsyBannerCompact,
  loadingBanner,
  pickBanner
} from './theme/ascii.ts';
export {
  prefersReducedMotion,
  reducedMotion,
  resetReducedMotionCache,
  animationInterval,
  spinnerFrames,
  showAnimatedCursor
} from './theme/motion.ts';

/* ── Chat/dialog components (TASK-072) ──────────────────────────────── */
export { MessageBubble, type MessageBubbleProps } from './components/chat/message-bubble.tsx';
export { StreamingCursor, type StreamingCursorProps } from './components/chat/streaming-cursor.tsx';
export { TokenMeter, type TokenMeterProps } from './components/chat/token-meter.tsx';
export { StatusFooter, type StatusFooterProps, type ConnectionStatus } from './components/chat/status-footer.tsx';
export { Transcript, type TranscriptProps, type TranscriptTurn } from './components/chat/transcript.tsx';

/* ── Stream-event components (TASK-073) ─────────────────────────────── */
export { ModelDelta, type ModelDeltaProps } from './components/stream-events/model-delta.tsx';
export { StreamThinkingBlock, type StreamThinkingBlockProps } from './components/stream-events/thinking-block.tsx';
export {
  ToolLifecycle,
  type ToolLifecycleProps,
  type ToolCallEvent,
  type ToolCallStatus
} from './components/stream-events/tool-lifecycle.tsx';
export {
  ApprovalState,
  type ApprovalStateProps,
  type ApprovalStatus
} from './components/stream-events/approval-state.tsx';

/* ── Provider/model chooser (TASK-085) ──────────────────────────────── */
export { SearchInput, type SearchInputProps } from './components/model-picker/search-input.tsx';
export { ProviderList, type ProviderListProps, type ProviderEntry } from './components/model-picker/provider-list.tsx';
export { ModelSelect, type ModelSelectProps, type ModelEntry } from './components/model-picker/model-select.tsx';

/* ── Agent picker (TASK-SIA-013) ────────────────────────────────────── */
export {
  AgentPicker,
  type AgentPickerProps,
  type AgentEntry,
  type AgentProvenance
} from './components/agent-picker/index.tsx';

/* ── Agent renderer (TASK-007) ──────────────────────────────────────── */
export {
  createInkAgentRenderer,
  type InkAgentRendererHandle,
  type InkAgentRendererOptions
} from './create-ink-agent-renderer.ts';
