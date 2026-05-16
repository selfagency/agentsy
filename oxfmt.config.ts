import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  ...ultracite,
  arrowParens: 'avoid',
  bracketSpacing: true,
  printWidth: 120,
  proseWrap: 'preserve',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  ignorePatterns: [
    ...(ultracite.ignorePatterns || []),
    'node_modules',
    'dist',
    'gh-pages',
    'coverage',
    '.codacy',
    '.agents',
    '.beans'
  ]
});
