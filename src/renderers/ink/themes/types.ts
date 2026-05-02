export interface ThinkingTheme {
  borderColor: string;
  textColor: string;
  spinnerColor: string;
}

export interface ToolCallTheme {
  pendingColor: string;
  doneColor: string;
  pendingSymbol: string;
  doneSymbol: string;
}

export interface TextTheme {
  cursorSymbol: string;
  dimColor: boolean;
}

export interface BorderTheme {
  style: 'single' | 'double' | 'round' | 'none';
  color: string;
}

export interface HighlightTheme {
  theme?: string;
}

export interface Theme {
  thinking: ThinkingTheme;
  toolCall: ToolCallTheme;
  text: TextTheme;
  border: BorderTheme;
  highlight: HighlightTheme;
}

export type ThemeName =
  | 'default'
  | 'dark'
  | 'light'
  | 'minimal'
  | 'dracula'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'catppuccin-macchiato'
  | 'catppuccin-frappe'
  | 'ayu-mirage'
  | 'houston'
  | 'one-dark'
  | 'one-candy'
  | 'github-dark';

