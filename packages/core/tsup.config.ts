import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    processor: 'src/processor/index.ts',
    context: 'src/context/index.ts',
    formatting: 'src/formatting/index.ts',
    'xml-filter': 'src/xml-filter/index.ts',
    renderers: 'src/renderer/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@agentsy/types',
    '@agentsy/core/processor',
    '@agentsy/core/context',
    '@agentsy/core/formatting',
    '@agentsy/core/xml-filter',
    'zod',
  ],
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'node18',
});
