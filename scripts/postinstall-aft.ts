/**
 * Postinstall script — resolve the AFT Rust binary.
 *
 * Runs after `pnpm install` to download/cache the @cortexkit/aft binary
 * so it's available at runtime without further network requests.
 *
 * Uses the `@cortexkit/aft-bridge` package's built-in resolver.
 * Falls back to a clear error message if resolution fails.
 */

import { ensureBinary } from '@cortexkit/aft-bridge/resolver.js';

async function main() {
  console.log('[postinstall:aft] Resolving AFT binary...');
  const start = performance.now();

  try {
    const binaryPath = await ensureBinary();

    if (binaryPath) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      console.log(`[postinstall:aft] ✅ AFT binary resolved at ${binaryPath} (${elapsed}s)`);
    } else {
      // ensureBinary returns a string path on success — empty/null means unresolved
      console.warn('[postinstall:aft] ⚠️ AFT binary could not be auto-resolved.');
      console.warn('[postinstall:aft] Run `npx @cortexkit/aft setup` to resolve manually.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[postinstall:aft] ⚠️ AFT binary resolution failed: ${message}`);
    console.warn('[postinstall:aft] Run `npx @cortexkit/aft setup` manually.');
    // Non-failure — postinstall should never block install
  }
}

main();
