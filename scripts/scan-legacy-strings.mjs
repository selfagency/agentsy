#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Scan docs and README for legacy monolith string outside the migration docs and generated site.
 * Intentionally limited to docs/ and README in PR1 to avoid blocking existing source JSDoc; expand later.
 */
const ROOT = process.cwd();
const LEGACY = '@selfagency/llm-stream-parser';

const INCLUDE = ['README.md', 'docs'];

const EXCLUDE_PREFIXES = [path.join('docs', 'migration'), '.gh-pages', 'coverage', 'dist'];

async function isExcluded(relPath) {
  return EXCLUDE_PREFIXES.some(prefix => relPath === prefix || relPath.startsWith(prefix + path.sep));
}

async function walk(relDir, out) {
  const absDir = path.join(ROOT, relDir);
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const rel = path.join(relDir, ent.name);
    if (await isExcluded(rel)) continue;
    const abs = path.join(ROOT, rel);
    if (ent.isDirectory()) {
      await walk(rel, out);
    } else if (ent.isFile()) {
      if (!ent.name.endsWith('.md')) continue;
      out.push(rel);
    }
  }
}

async function main() {
  const candidates = new Set();

  for (const p of INCLUDE) {
    const abs = path.join(ROOT, p);
    let s;
    try {
      s = await stat(abs);
    } catch {
      continue;
    }
    if (s.isFile()) {
      candidates.add(p);
    } else if (s.isDirectory()) {
      await walk(p, candidates);
    }
  }

  const offenders = [];
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    const content = await readFile(abs, 'utf8');
    let idx = content.indexOf(LEGACY);
    if (idx === -1) continue;

    // Line/column reporting for first N matches
    const lines = content.split(/\r?\n/);
    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
      const col = lines[lineNo].indexOf(LEGACY);
      if (col !== -1) {
        const preview = lines[lineNo].slice(Math.max(0, col - 20), col + LEGACY.length + 20);
        offenders.push({ rel, line: lineNo + 1, col: col + 1, preview });
      }
    }
  }

  if (offenders.length > 0) {
    console.error('Legacy monolith reference found outside allowlist (docs/migration, .gh-pages, dist, coverage):');
    for (const o of offenders) {
      console.error(`${o.rel}:${o.line}:${o.col}  ${o.preview}`);
    }
    process.exitCode = 1;
  } else {
    console.log('No disallowed legacy monolith references found.');
  }
}

main().catch(err => {
  console.error('scan-legacy-strings failed:', err);
  process.exitCode = 1;
});
