#!/usr/bin/env node
/**
 * Theme Preview Utility
 * Displays all available Ink renderer themes with sample output
 *
 * Usage: node scripts/preview-themes.js
 */

import chalk from 'chalk';
import {
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
} from '../dist/renderers/ink/themes/index.js';

const THEMES = [
  { name: 'default', theme: defaultTheme },
  { name: 'dark', theme: darkTheme },
  { name: 'light', theme: lightTheme },
  { name: 'minimal', theme: minimalTheme },
  { name: 'dracula', theme: draculaTheme },
  { name: 'catppuccin-mocha', theme: catppuccinMochaTheme },
  { name: 'catppuccin-latte', theme: catppuccinLatteTheme },
  { name: 'catppuccin-macchiato', theme: catppuccinMacchiatoTheme },
  { name: 'catppuccin-frappe', theme: catppuccinFrappeTheme },
  { name: 'ayu-mirage', theme: ayuMirageTheme },
  { name: 'houston', theme: houstonTheme },
  { name: 'one-dark', theme: oneDarkTheme },
  { name: 'one-candy', theme: oneCandyTheme },
  { name: 'github-dark', theme: githubDarkTheme },
];

function applyColor(text, color) {
  if (!color) return text;
  if (color.startsWith('#')) {
    return chalk.hex(color)(text);
  }
  return chalk[color]?.(text) ?? text;
}

function displayThemePreview() {
  console.log(`\n${chalk.bold.cyan('═══════════════════════════════════')}`);
  console.log(chalk.bold.cyan('  Available Ink Renderer Themes'));
  console.log(`${chalk.bold.cyan('═══════════════════════════════════')}\n`);

  for (const { name, theme } of THEMES) {
    console.log(chalk.bold.white(name.padEnd(25)));

    if (theme.thinking) {
      const textColor = theme.thinking.textColor || 'cyan';
      const spinnerColor = theme.thinking.spinnerColor || 'cyan';
      console.log(
        `  ${applyColor('├─ Thinking:', textColor)} ${applyColor(`text=${textColor}, spinner=${spinnerColor}`, spinnerColor)}`,
      );
    }

    if (theme.toolCall) {
      const pendingColor = theme.toolCall.pendingColor || 'yellow';
      const doneColor = theme.toolCall.doneColor || 'green';
      const pendingSymbol = theme.toolCall.pendingSymbol || '⠋';
      const doneSymbol = theme.toolCall.doneSymbol || '✓';
      console.log(
        `  ${applyColor(`└─ Tools: ${pendingSymbol}`, pendingColor)} ${applyColor('pending', pendingColor)} ${applyColor(`${doneSymbol} done`, doneColor)}`,
      );
    }

    if (theme.border) {
      console.log(`  ${chalk.dim(`Border: ${theme.border.style}`)}`);
    }

    console.log();
  }

  console.log(chalk.dim('═══════════════════════════════════'));
  console.log(chalk.dim('\nUsage:'));
  console.log(chalk.dim('  createInkRenderer({ theme: "theme-name" })'));
  console.log(chalk.dim('  import { draculaTheme } from "@selfagency/llm-stream-parser"\n'));
}

displayThemePreview();
