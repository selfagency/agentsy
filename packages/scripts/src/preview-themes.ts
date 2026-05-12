#!/usr/bin/env node
// fallow-ignore-file unused-file
/**
 * Theme Preview Utility
 * Displays all available Ink renderer themes with sample output
 *
 * Usage: node scripts/preview-themes.js
 */

import chalk from 'chalk';
// Attempt to load built output first (when running from installed package),
// otherwise fall back to local workspace source so this script works during dev
// without requiring a build step. This reduces duplicate source files and
// allows CI and local tooling to run the preview command in either state.
let themesModule;
try {
  // fallow-ignore-next-line unresolved-import
  themesModule = await import('../dist/renderers/ink/themes/index.js');
} catch {
  // Fallback to local source so contributors can run the script before building
  // fallow-ignore-next-line unresolved-import
  themesModule = await import('../../renderers/src/ink/themes/index.ts');
}

const entries = Object.entries(themesModule).map(([name, value]) => ({ name, value }));

console.log('Available themes:');
for (const e of entries) console.log('-', e.name);

const THEMES = Object.entries(themesModule).map(([name, theme]) => ({ name, theme }));

/**
 * Apply color to text using chalk. JSDoc types avoid implicit any in strict typechecks.
 * @param {string} text
 * @param {string | undefined} color
 */
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
      const thinkingText = `text=${textColor}, spinner=${spinnerColor}`;
      console.log(`  ${applyColor('├─ Thinking:', textColor)} ${applyColor(thinkingText, spinnerColor)}`);
    }

    if (theme.toolCall) {
      const pendingColor = theme.toolCall.pendingColor || 'yellow';
      const doneColor = theme.toolCall.doneColor || 'green';
      const pendingSymbol = theme.toolCall.pendingSymbol || '⠋';
      const doneSymbol = theme.toolCall.doneSymbol || '✓';
      const toolsPending = `Tools: ${pendingSymbol}`;
      const toolsPreview = `pending`;
      const toolsDone = `${doneSymbol} done`;
      const toolsPendingText = `└─ ${toolsPending}`;
      const toolsLine = `  ${applyColor(toolsPendingText, pendingColor)} ${applyColor(toolsPreview, pendingColor)} ${applyColor(toolsDone, doneColor)}`;
      console.log(toolsLine);
    }

    if (theme.border) {
      const borderText = `Border: ${theme.border.style}`;
      const borderLine = `  ${chalk.dim(borderText)}`;
      console.log(borderLine);
    }

    console.log();
  }

  console.log(chalk.dim('═══════════════════════════════════'));
  console.log(chalk.dim('\nUsage:'));
  console.log(chalk.dim('  createInkRenderer({ theme: "theme-name" })'));
  console.log(chalk.dim(String.raw`  import { draculaTheme } from "../src/ink/themes/index.js"\n`));
}

displayThemePreview();
