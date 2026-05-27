//# hash=483d124920719537122b05c2b5765beb
//# sourceMappingURL=vitest.config.js.map

import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        exclude: [
            'src/e2e/**',
            '.tui-test/**',
            'node_modules/**',
            'dist/**'
        ]
    }
});
