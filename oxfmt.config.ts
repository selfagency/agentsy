import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

import prettierConfig from './prettier.config.ts';

export default defineConfig({
  ...ultracite,
  ...prettierConfig,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    'node_modules',
    'dist',
    'gh-pages',
    'coverage',
    '.codacy',
    '.agents',
    '.beans'
  ]
});
