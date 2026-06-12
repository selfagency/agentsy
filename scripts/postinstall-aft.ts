/**
 * Postinstall script — resolve the AFT Rust binary.
 *
 * Runs after `pnpm install` to ensure the AFT binary is available.
 * Uses npx to invoke the @cortexkit/aft CLI's setup, which handles
 * binary resolution, caching, and harness configuration.
 */

import { execSync } from 'node:child_process';

function main(): void {
  console.log('[postinstall:aft] Checking AFT binary...');

  try {
    // Try `aft doctor` first — binary already resolved
    execSync('npx --yes @cortexkit/aft@latest doctor', {
      stdio: 'pipe',
      timeout: 15_000,
      env: { ...process.env, CI: 'true' }
    });
    console.log('[postinstall:aft] ✅ AFT binary already resolved');
  } catch {
    // Binary not found — run setup
    console.log('[postinstall:aft] Resolving AFT binary...');
    try {
      execSync('npx --yes @cortexkit/aft@latest setup', {
        stdio: 'pipe',
        timeout: 30_000,
        env: { ...process.env, CI: 'true' }
      });
      console.log('[postinstall:aft] ✅ AFT binary resolved');
    } catch (setupError) {
      const message = setupError instanceof Error ? setupError.message : String(setupError);
      console.warn(`[postinstall:aft] ⚠️ AFT binary resolution: ${message}`);
      console.warn('[postinstall:aft] Run `npx @cortexkit/aft setup` manually.');
    }
  }
}

main();
