import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';
import vitest from 'ultracite/oxlint/vitest';

export default defineConfig({
  // Configure core linting rules for monorepo
  categories: {
    correctness: 'warn'
  },
  rules: {
    'class-methods-use-this': 'off',
    'jsdoc/require-yields': 'off' // Fix type-aware helper method warnings
  },
  // Child package configs should extend this base config
  // via relative imports
  root: {
    extends: ['.oxlintrc.json', 'oxlint.config.ts']
  }
});
