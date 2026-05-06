import type { Theme, ThemeName } from './types.js';

export type { ThemeName } from './types.js';

export const defaultTheme: Theme = {
  thinking: { borderColor: 'gray', textColor: 'gray', spinnerColor: 'gray' },
  toolCall: { pendingColor: 'yellow', doneColor: 'green', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▌', dimColor: true },
  border: { style: 'single', color: 'gray' },
  highlight: {},
};

export const darkTheme: Theme = {
  thinking: { borderColor: 'cyan', textColor: 'cyan', spinnerColor: 'cyan' },
  toolCall: { pendingColor: 'yellowBright', doneColor: 'greenBright', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▌', dimColor: false },
  border: { style: 'round', color: 'cyan' },
  highlight: {},
};

export const lightTheme: Theme = {
  thinking: { borderColor: 'blue', textColor: 'blue', spinnerColor: 'blue' },
  toolCall: { pendingColor: 'yellow', doneColor: 'green', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▌', dimColor: true },
  border: { style: 'single', color: 'blue' },
  highlight: {},
};

export const minimalTheme: Theme = {
  thinking: { borderColor: '', textColor: '', spinnerColor: '' },
  toolCall: { pendingColor: '', doneColor: '', pendingSymbol: '>', doneSymbol: '+' },
  text: { cursorSymbol: '_', dimColor: false },
  border: { style: 'none', color: '' },
  highlight: {},
};

// Dracula — https://draculatheme.com
export const draculaTheme: Theme = {
  thinking: { borderColor: '#6272a4', textColor: '#6272a4', spinnerColor: '#8be9fd' },
  toolCall: { pendingColor: '#ffb86c', doneColor: '#50fa7b', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#44475a' },
  highlight: { theme: 'dracula' },
};

// Catppuccin Mocha — https://catppuccin.com
export const catppuccinMochaTheme: Theme = {
  thinking: { borderColor: '#7f849c', textColor: '#7f849c', spinnerColor: '#94e2d5' },
  toolCall: { pendingColor: '#fab387', doneColor: '#a6e3a1', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#313244' },
  highlight: { theme: 'catppuccin-mocha' },
};

// Catppuccin Latte — https://catppuccin.com (light variant)
export const catppuccinLatteTheme: Theme = {
  thinking: { borderColor: '#9ca0b0', textColor: '#9ca0b0', spinnerColor: '#179299' },
  toolCall: { pendingColor: '#fe640b', doneColor: '#40a02b', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: true },
  border: { style: 'single', color: '#ccd0da' },
  highlight: { theme: 'catppuccin-latte' },
};

// Catppuccin Macchiato — https://catppuccin.com
export const catppuccinMacchiatoTheme: Theme = {
  thinking: { borderColor: '#6e738d', textColor: '#6e738d', spinnerColor: '#8aadf4' },
  toolCall: { pendingColor: '#f5a97f', doneColor: '#a6da95', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#363a4f' },
  highlight: { theme: 'catppuccin-macchiato' },
};

// Catppuccin Frappé — https://catppuccin.com
export const catppuccinFrappeTheme: Theme = {
  thinking: { borderColor: '#737994', textColor: '#737994', spinnerColor: '#8caaee' },
  toolCall: { pendingColor: '#ef9f76', doneColor: '#a6d189', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#414559' },
  highlight: { theme: 'catppuccin-frappe' },
};

// Ayu Mirage — https://github.com/dempfi/ayu
export const ayuMirageTheme: Theme = {
  thinking: { borderColor: '#6e7c8f', textColor: '#6e7c8f', spinnerColor: '#5ccfe6' },
  toolCall: { pendingColor: '#ffa659', doneColor: '#d5ff80', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#282e3b' },
  highlight: { theme: 'ayu-mirage' },
};

// Houston — Astro's official theme — https://github.com/withastro/houston-vscode
export const houstonTheme: Theme = {
  thinking: { borderColor: '#545864', textColor: '#545864', spinnerColor: '#4bf3c8' },
  toolCall: { pendingColor: '#ffd493', doneColor: '#4bf3c8', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#23262d' },
  highlight: {},
};

// One Dark — based on Atom's One Dark palette
export const oneDarkTheme: Theme = {
  thinking: { borderColor: '#5c6370', textColor: '#5c6370', spinnerColor: '#56b6c2' },
  toolCall: { pendingColor: '#d19a66', doneColor: '#98c379', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#3e4451' },
  highlight: { theme: 'one-dark' },
};

// OneCandy — One Dark with pastel candy accents — https://github.com/KacperBiedka/OneCandy
export const oneCandyTheme: Theme = {
  thinking: { borderColor: '#7f848e', textColor: '#7f848e', spinnerColor: '#71d0fc' },
  toolCall: { pendingColor: '#fcdfad', doneColor: '#79c3a4', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#3e4451' },
  highlight: {},
};

// GitHub Dark — GitHub Primer color system
export const githubDarkTheme: Theme = {
  thinking: { borderColor: '#8b949e', textColor: '#8b949e', spinnerColor: '#39c5cf' },
  toolCall: { pendingColor: '#ffa657', doneColor: '#3fb950', pendingSymbol: '⠋', doneSymbol: '✓' },
  text: { cursorSymbol: '▋', dimColor: false },
  border: { style: 'round', color: '#161b22' },
  highlight: { theme: 'github-dark' },
};

export const THEME_MAP: Record<ThemeName, Theme> = {
  default: defaultTheme,
  dark: darkTheme,
  light: lightTheme,
  minimal: minimalTheme,
  dracula: draculaTheme,
  'catppuccin-mocha': catppuccinMochaTheme,
  'catppuccin-latte': catppuccinLatteTheme,
  'catppuccin-macchiato': catppuccinMacchiatoTheme,
  'catppuccin-frappe': catppuccinFrappeTheme,
  'ayu-mirage': ayuMirageTheme,
  houston: houstonTheme,
  'one-dark': oneDarkTheme,
  'one-candy': oneCandyTheme,
  'github-dark': githubDarkTheme,
};

function isThemeName(value: string): value is ThemeName {
  return Object.hasOwn(THEME_MAP, value);
}

export function resolveTheme(theme?: Theme | ThemeName): Theme {
  if (!theme) {
    return defaultTheme;
  }
  if (typeof theme !== 'string') {
    return theme;
  }

  if (isThemeName(theme)) {
    return THEME_MAP[theme];
  }

  return defaultTheme;
}
