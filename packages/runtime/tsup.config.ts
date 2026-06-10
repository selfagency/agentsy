import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: 'src/index.ts',
    'ag-ui': 'src/ag-ui/index.ts',
    approval: 'src/approval/index.ts',
    loop: 'src/loop/index.ts'
  },
  external: ['@agentsy/guardrails'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
