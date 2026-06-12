import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/**
 * Resolve the path to CortexKit's shared SQLite database.
 *
 * Uses the XDG data directory on Linux/macOS (~/.local/share/cortexkit/magic-context/)
 * and the equivalent on Windows.
 */
export function resolveCortexKitDbDir(): string {
  // Respect XDG_DATA_HOME if set
  let base: string;
  const xdgData = process.env.XDG_DATA_HOME;

  if (xdgData && xdgData.length > 0) {
    base = xdgData;
  } else if (platform() === 'win32') {
    base = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'cortexkit');
  } else {
    base = join(homedir(), '.local', 'share', 'cortexkit');
  }

  return join(base, 'magic-context');
}

/**
 * Resolve the full path to Magic Context's SQLite database file.
 */
export function resolveCortexKitDbPath(): string {
  return join(resolveCortexKitDbDir(), 'context.db');
}

/**
 * Ensure the CortexKit data directory exists.
 */
export function ensureCortexKitDbDir(): string {
  const dir = resolveCortexKitDbDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Check whether Magic Context's database exists on disk.
 */
export function isCortexKitDbPresent(): boolean {
  return existsSync(resolveCortexKitDbPath());
}
