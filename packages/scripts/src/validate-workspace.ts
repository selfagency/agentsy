#!/usr/bin/env node
import { constants as fsConstants } from 'node:fs';
import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Validate that every first-level directory under packages/* is a real package (has package.json).
 * Temporary allowlist: ignore directories we intentionally keep non-packaged for now.
 */
// Compute packages directory inside main so tests can override it.
// Default behavior: packages/ under current working directory.
// Allowlist: tweak as migrations proceed. Keep 'core' as a common non-packaged dir.
const IGNORE_DIRS = new Set(['core']);

async function dirExists(p: string) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function hasFile(p: string) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main(packagesDir?: string) {
  const ROOT = process.cwd();
  const PACKAGES_DIR = packagesDir ?? path.join(ROOT, 'packages');

  try {
    // Distinguish three cases:
    // - packages directory does not exist -> skip
    // - packages path exists but is not a directory -> error
    // - packages directory exists -> continue
    try {
      const s = await stat(PACKAGES_DIR);
      if (!s.isDirectory()) {
        console.error('packages path exists but is not a directory');
        process.exitCode = 1;
        return;
      }
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        console.log('No packages/ directory found. Skipping workspace validation.');
        process.exitCode = 0;
        return;
      }
      throw err;
    }

    const entries = await readdir(PACKAGES_DIR, { withFileTypes: true });
    const offenders = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const name = ent.name;
      if (name.startsWith('.')) continue; // ignore dotdirs
      if (IGNORE_DIRS.has(name)) continue;

      const full = path.join(PACKAGES_DIR, name);
      const pkgJson = path.join(full, 'package.json');

      const hasPkgJson = await hasFile(pkgJson);
      if (!hasPkgJson) {
        offenders.push(path.relative(ROOT, full));
      }
    }

    if (offenders.length > 0) {
      console.error('Workspace contains non-packages under packages/*:');
      for (const o of offenders) console.error(` - ${o} (missing package.json)`);
      process.exitCode = 1;
    } else {
      console.log('Workspace validation passed: all packages/* are real packages.');
      process.exitCode = 0;
    }
  } catch (err) {
    console.error('validate-workspace failed:', err);
    process.exitCode = 1;
    return;
  }
}

// Export `main` for tests to import and call directly while preserving CLI behavior.
export { main };

// CLI entrypoint when run directly.
if (process.argv[1] && process.argv[1].endsWith('validate-workspace.js')) {
  main().catch(err => {
    console.error('validate-workspace failed:', err);
    process.exitCode = 1;
  });
}

// fallow-ignore-file unused-file
