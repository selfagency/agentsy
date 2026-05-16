import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';
import vitest from 'ultracite/oxlint/vitest';

export default defineConfig({
  extends: [core, vitest, react],
  plugins: ['unicorn', 'typescript', 'oxc', 'import', 'promise', 'node', 'vitest'],
  categories: {},
  rules: {
    'vitest/require-mock-type-parameters': 'warn',
    'func-style': 'warn',
    'no-inline-comments': 'off',
    'unicorn/no-array-for-each': 'off',
    'promise/avoid-new': 'off',
    'no-promise-executor-return': 'off',
    'jsdoc/require-yields': 'off',
    'sort-keys': 'off',
    'max-classes-per-file': 'off',
    'default-case': 'off',
    'unicorn/no-array-reduce': 'off',
    'vitest/prefer-called-exactly-once-with': 'off',
    'promise/prefer-await-to-callbacks': 'off',
    'class-methods-use-this': 'warn',
    'no-empty-function': 'warn',
    'unicorn/consistent-function-scoping': 'warn',
    'vitest/max-expects': 'off',
    'vitest/prefer-describe-function-title': 'off'
  },
  settings: {
    jsdoc: {
      ignorePrivate: false,
      ignoreInternal: false,
      ignoreReplacesDocs: true,
      overrideReplacesDocs: true,
      augmentsExtendsReplacesDocs: false,
      implementsReplacesDocs: false,
      exemptDestructuredRootsFromChecks: false,
      tagNamePreference: {}
    },
    vitest: {
      typecheck: false
    }
  },
  env: {
    builtin: true
  },
  ignorePatterns: [
    ...(core.ignorePatterns || []),
    'node_modules',
    'dist',
    'gh-pages',
    'coverage',
    '.codacy',
    '.agents',
    '.beans'
  ]
});
