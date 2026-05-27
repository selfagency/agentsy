//# hash=03c0c657839032ffbe95f21721d3b54b
//# sourceMappingURL=tsup.config.js.map

import { defineConfig } from 'tsup';
export default defineConfig({
    clean: true,
    dts: true,
    entry: {
        index: 'src/index.ts',
        cli: 'src/cli.ts'
    },
    external: [
        '@agentsy/models',
        '@agentsy/providers'
    ],
    format: [
        'esm',
        'cjs'
    ],
    sourcemap: true,
    splitting: false,
    target: 'es2022'
});
