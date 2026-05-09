#!/usr/bin/env node
import { constants as fsConstants } from 'node:fs';
import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Validate that every first-level directory under packages/* is a real package (has package.json).
 * Temporary allowlist: ignore directories we intentionally keep non-packaged for now.
 */
const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, 'packages');
// Allowlist: tweak as migrations proceed. `core` is ignored until fully removed from VCS.
const IGNORE_DIRS = new Set(['core']);

async function dirExists(p) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function hasFile(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await dirExists(PACKAGES_DIR))) {
    console.log('No packages/ directory found. Skipping workspace validation.');
    return;
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
  }
}

main().catch(err => {
  console.error('validate-workspace failed:', err);
  process.exitCode = 1;
});
