/**
 * AFT bridge pool manager.
 *
 * Uses @cortexkit/aft-bridge's BridgePool to manage one persistent `aft`
 * Rust process per project root.
 *
 * The bridge pool is lazily initialized — first call resolves the binary
 * and starts the worker process.
 */

import type { PoolOptions } from '@cortexkit/aft-bridge';
import { BridgePool, findBinary } from '@cortexkit/aft-bridge';

let pool: BridgePool | null = null;
let initialized = false;

export interface AftBridgeOptions {
  projectRoot: string;
}

/**
 * Get or create the shared AFT bridge pool.
 *
 * @param binaryPathOrOptions - Path to the AFT binary, or options object
 * @param poolOptions - Optional pool configuration
 */
export async function getAftBridge(options: AftBridgeOptions & { poolOptions?: PoolOptions }): Promise<BridgePool> {
  if (!initialized) {
    const binaryPath = await findBinary();
    if (!binaryPath) {
      throw new Error('AFT binary not found. Run `npx @cortexkit/aft setup` or ensure it is installed.');
    }

    pool = new BridgePool(binaryPath, options.poolOptions);
    initialized = true;
  }

  if (!pool) {
    throw new Error('AFT bridge pool failed to initialize');
  }

  return pool;
}

/**
 * Get a session bridge for a given project root.
 */
export async function getAftSessionBridge(
  options: AftBridgeOptions
): Promise<import('@cortexkit/aft-bridge').BinaryBridge> {
  const bridgePool = await getAftBridge(options);
  return bridgePool.getBridge(options.projectRoot);
}

/**
 * Check whether the AFT binary is available.
 */
export async function isAftAvailable(): Promise<boolean> {
  try {
    const binaryPath = await findBinary();
    return binaryPath !== null;
  } catch {
    return false;
  }
}

/**
 * Shut down the bridge pool.
 */
export async function shutdownAftBridge(): Promise<void> {
  if (pool) {
    await pool.shutdown();
    pool = null;
    initialized = false;
  }
}
