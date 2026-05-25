/**
 * Semantic ANSI palette tokens for the acid ANSI BBS visual system.
 *
 * All Ink components consume these tokens rather than raw ANSI color strings,
 * enabling consistent theming, accessibility-safe contrasts, and reduced-motion
 * fallbacks throughout the TUI.
 *
 * Colour values are Ink-compatible strings (standard ANSI names + gray).
 * Components apply dimming via Ink's <Text dimColor> prop, not via palette.
 */

/**
 * Semantic palette — each token maps to an Ink-compatible colour string.
 *
 * Tokens are grouped by usage domain (assistant, user, system, accent, status)
 * so that components can pick the right semantic colour without knowing the
 * underlying ANSI value.
 */
export interface AcidPalette {
  /* ── Assistant (model response) ──────────────────────────────── */
  /** Primary assistant text colour (cyan family). */
  assistantText: string;
  /** Dimmed assistant text (thinking, metadata) — applied via dimColor on Text. */
  assistantDim: string;
  /** Assistant accent (highlighted tokens, cursors). */
  assistantAccent: string;

  /* ── User (human input) ──────────────────────────────────────── */
  /** Primary user text colour (green family). */
  userText: string;
  /** Dimmed user text (timestamps, metadata). */
  userDim: string;

  /* ── System (status, frames, borders) ─────────────────────────── */
  /** Primary frame/border colour. */
  frameBorder: string;
  /** Dimmed frame elements (separators, continuations). */
  frameDim: string;
  /** Bright frame highlights (title bars, active borders). */
  frameBright: string;

  /* ── Accents ──────────────────────────────────────────────────── */
  /** Warning/highlight colour (yellow family). */
  warning: string;
  /** Error/stop colour (red family). */
  error: string;
  /** Success/complete colour (green family). */
  success: string;
  /** Info/neutral colour (blue family). */
  info: string;

  /* ── Status indicators ────────────────────────────────────────── */
  /** Pending/spinner colour. */
  pending: string;
  /** Disabled/muted elements. */
  muted: string;
  /** Emphasis/highlight on demand. */
  emphasis: string;
}

/**
 * Default acid ANSI palette — high-contrast, terminal-safe ANSI names.
 *
 * Designed for dark-background terminals. Cyan → assistant, green → user,
 * yellow → warnings, red → errors — conventional BBS mapping.
 */
export const defaultAcidPalette: AcidPalette = {
  assistantText: 'cyan',
  assistantDim: 'cyan',
  assistantAccent: 'cyanBright',

  userText: 'green',
  userDim: 'green',

  frameBorder: 'gray',
  frameDim: 'gray',
  frameBright: 'white',

  warning: 'yellow',
  error: 'red',
  success: 'green',
  info: 'blue',

  pending: 'yellow',
  muted: 'gray',
  emphasis: 'white'
};

/**
 * High-contrast acid palette — uses bright variants for accessibility.
 */
export const highContrastAcidPalette: AcidPalette = {
  assistantText: 'cyanBright',
  assistantDim: 'cyan',
  assistantAccent: 'white',

  userText: 'greenBright',
  userDim: 'green',

  frameBorder: 'blackBright',
  frameDim: 'gray',
  frameBright: 'white',

  warning: 'yellowBright',
  error: 'redBright',
  success: 'greenBright',
  info: 'blueBright',

  pending: 'yellowBright',
  muted: 'blackBright',
  emphasis: 'white'
};

/**
 * Monochrome acid palette — zero ANSI colour for accessibility.
 */
export const monochromeAcidPalette: AcidPalette = {
  assistantText: 'white',
  assistantDim: 'gray',
  assistantAccent: 'white',

  userText: 'white',
  userDim: 'gray',

  frameBorder: 'gray',
  frameDim: 'gray',
  frameBright: 'white',

  warning: 'white',
  error: 'white',
  success: 'white',
  info: 'white',

  pending: 'gray',
  muted: 'gray',
  emphasis: 'white'
};
