import { defineConfig } from 'tsup';

export default defineConfig({
  dts: {
    resolve: true
  },
  entry: {
    index: 'src/index.ts',
    'llm-stats-client': 'src/llm-stats-client.ts',
    'search-contracts': 'src/search-contracts.ts'
  },
  external: ['node-fetch'],
  format: ['esm', 'cjs'],
  target: 'node20'
});
