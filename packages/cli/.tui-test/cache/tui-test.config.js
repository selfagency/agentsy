//# hash=3392a1f9507dd467a7623de9fa312731
//# sourceMappingURL=tui-test.config.js.map

import { defineConfig } from '@microsoft/tui-test';
export default defineConfig({
    /**
   * Retry flaky tests up to 2 times.
   */ retries: 2,
    /**
   * Capture VT traces for failure debugging.
   */ trace: true,
    /**
   * Test file pattern — discover all .spec.ts files in src/e2e/.
   */ testMatch: [
        'src/e2e/**/*.spec.ts'
    ]
});
