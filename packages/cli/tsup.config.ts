import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  external: [
    '@agentsy/core',
    '@agentsy/models',
    '@agentsy/providers',
    '@agentsy/tokenomics',
    '@cortexkit/aft',
    '@cortexkit/magic-context'
  ],
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
