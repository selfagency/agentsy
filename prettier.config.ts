import type { ArrowParensConfig, ProseWrapConfig, TrailingCommaConfig } from 'oxfmt';

export default {
  arrowParens: 'avoid' as ArrowParensConfig,
  bracketSpacing: true,
  jsxBracketSameLine: true,
  printWidth: 120,
  proseWrap: 'preserve' as ProseWrapConfig,
  requirePragma: false,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none' as TrailingCommaConfig,
  useTabs: false
};
