/**
 * Skill discoverer — walks standard skill installation directories and
 * returns {@link SkillMetadata} for every skill found.
 *
 * Search roots (checked in descending priority):
 * 1. `{projectDir}/.agents/`
 * 2. `~/.agents/`
 * 3. `~/.config/agentsy/skills/`
 * 4. `$XDG_DATA_HOME/agentsy/skills/` (defaults to `~/.local/share/agentsy/skills/`)
 * 5. Bundled skills directory (optional, lowest priority)
 *
 * @module @agentsy/plugins/skills
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, resolve } from 'node:path';

import type { SkillMetadata } from './manifest.js';

/**
 * Internal root definition before resolution.
 */
interface SkillRoot {
  /** Resolved absolute path to the directory to scan. */
  path: string;
}

/**
 * Discovers agent skills from well-known filesystem locations.
 *
 * The discoverer walks project-local roots first, then user-global
 * roots, then system-level and bundled roots. Results preserve the
 * root order (highest priority first).
 */
export class SkillDiscoverer {
  readonly projectDir: string;
  /** Ordered list of skill roots, highest priority first. */
  readonly roots: SkillRoot[];

  /**
   * @param projectDir - Project root directory. Defaults to `process.cwd()`.
   * @param bundledDir - Path to bundled (built-in) skills.
   * @param userDir - User home directory override (for testing isolation).
   */
  constructor(projectDir?: string, bundledDir?: string, userDir?: string) {
    this.projectDir = projectDir ?? process.cwd();
    const home = userDir ?? homedir();

    const xdgDataHome = process.env.XDG_DATA_HOME
      ? resolve(process.env.XDG_DATA_HOME, 'agentsy', 'skills')
      : resolve(home, '.local', 'share', 'agentsy', 'skills');

    const roots: SkillRoot[] = [
      // 1. Project-local skills (highest priority)
      { path: resolve(this.projectDir, '.agents') },
      // 2. User home skills
      { path: resolve(home, '.agents') },
      // 3. XDG config skills
      { path: resolve(home, '.config', 'agentsy', 'skills') },
      // 4. XDG data skills
      { path: xdgDataHome }
    ];

    // 5. Bundled skills (lowest priority)
    if (bundledDir) {
      roots.push({ path: resolve(bundledDir) });
    }

    this.roots = roots;
  }

  /**
   * Discover skills across all configured roots.
   *
   * Roots are walked in priority order (project-local first, bundled
   * last). Roots that cannot be read are silently skipped.
   *
   * @returns All discovered skills in root-priority order.
   */
  async discover(): Promise<SkillMetadata[]> {
    const results: SkillMetadata[] = [];

    for (const root of this.roots) {
      const rootResults = await this.#discoverRoot(root);
      results.push(...rootResults);
    }

    return results;
  }

  /**
   * Discover skills from a single root directory.
   * Recursively walks subdirectories for .md files.
   */
  async #discoverRoot(root: SkillRoot): Promise<SkillMetadata[]> {
    let entries: string[];
    try {
      entries = await readdir(root.path);
    } catch {
      return [];
    }

    const mdFiles: string[] = [];

    for (const entry of entries) {
      const fullPath = resolve(root.path, entry);
      let entryStat: import('node:fs').Stats;
      try {
        entryStat = await stat(fullPath);
      } catch {
        continue;
      }

      if (entryStat.isDirectory()) {
        const subFiles = await this.#scanDir(fullPath);
        mdFiles.push(...subFiles);
      } else if (extname(entry) === '.md') {
        mdFiles.push(fullPath);
      }
    }

    const settled = await Promise.allSettled(
      mdFiles.map(async (file): Promise<SkillMetadata> => {
        const content = await readFile(file, 'utf-8');
        const meta = this.#parseFrontmatter(content);
        const fileName = basename(file);

        return {
          path: root.path,
          name: meta.name ?? basename(fileName, extname(fileName)),
          description: meta.description ?? '',
          ...(meta.version ? { version: meta.version } : {}),
          ...(meta.author ? { author: meta.author } : {}),
          ...(meta.license ? { license: meta.license } : {})
        } satisfies SkillMetadata;
      })
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<SkillMetadata> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  /** Recursively scan a directory for .md files (returns full absolute paths). */
  async #scanDir(dir: string): Promise<string[]> {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      try {
        const entryStat = await stat(fullPath);
        if (entryStat.isDirectory()) {
          const subFiles = await this.#scanDir(fullPath);
          results.push(...subFiles);
        } else if (extname(entry) === '.md') {
          results.push(fullPath);
        }
      } catch {
        // Silently skip unreadable entries
      }
    }

    return results;
  }

  /**
   * Parse YAML-like frontmatter from markdown content.
   *
   * Extracts only the fields relevant to {@link SkillMetadata}.
   * Returns an empty object when no valid frontmatter block is found.
   */
  #parseFrontmatter(content: string): {
    name?: string;
    description?: string;
    version?: string;
    author?: string;
    license?: string;
  } {
    const trimmed = content.trimStart();

    if (!trimmed.startsWith('---')) {
      return {};
    }

    const end = trimmed.indexOf('---', 3);
    if (end === -1) {
      return {};
    }

    const raw = trimmed.slice(3, end);
    const result: Record<string, string> = {};

    for (const line of raw.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1 || colonIdx === 0) {
        continue;
      }

      const key = line.slice(0, colonIdx).trim();
      const value = line
        .slice(colonIdx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');

      if (key.length === 0 || value.length === 0) {
        continue;
      }

      switch (key.toLowerCase()) {
        case 'name':
        case 'description':
        case 'version':
        case 'author':
        case 'license':
          result[key.toLowerCase()] = value;
          break;
        default:
          break;
      }
    }

    return result as { name?: string; description?: string; version?: string; author?: string; license?: string };
  }
}
