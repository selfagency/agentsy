import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';
import vitest from 'ultracite/oxlint/vitest';

export default defineConfig({
  extends: [core, vitest, react],
  categories: {
    correctness: 'warn'
  },
  rules: {
    'class-methods-use-this': 'off',
    'default-case': 'off',
    'eslint/no-plusplus': 'off',
    'func-style': 'off',
    'jsdoc/require-yields': 'off',
    'max-classes-per-file': 'off',
    'no-empty-function': 'off',
    'no-inline-comments': 'off',
    'no-promise-executor-return': 'off',
    'prefer-const': 'off',
    'promise/avoid-new': 'off',
    'promise/prefer-await-to-callbacks': 'off',
    'sort-keys': 'off',
    'typescript/no-dynamic-delete': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-array-reduce': 'off',
    'vitest/max-expects': 'off',
    'vitest/prefer-called-exactly-once-with': 'off',
    'vitest/prefer-describe-function-title': 'off',
    'vitest/require-mock-type-parameters': 'off'
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
  ],
  options: {
    typeAware: true,
    typeCheck: true
  }
});
