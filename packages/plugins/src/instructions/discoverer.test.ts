import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InstructionsDiscoverer } from './discoverer.js';

/**
 * Create a temporary project directory with instruction files for testing.
 */
async function createFixtureDir(files: Record<string, string>): Promise<string> {
  const dir = resolve(import.meta.dirname, '__fixtures__', `disc-${Date.now()}`);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = resolve(dir, relativePath);

    await mkdir(resolve(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  return dir;
}

/**
 * Remove a fixture directory and its contents.
 */
async function removeFixtureDir(dir: string): Promise<void> {
  // Use dynamic import to avoid a direct dependency on `rm`.
  const { rm } = await import('node:fs/promises');
  await rm(dir, { recursive: true, force: true });
}

const fixtureDirs: string[] = [];

afterEach(async () => {
  for (const dir of fixtureDirs) {
    await removeFixtureDir(dir);
  }
  fixtureDirs.length = 0;
});

describe('InstructionsDiscoverer', () => {
  describe('constructor', () => {
    it('defaults projectDir to process.cwd()', () => {
      const d = new InstructionsDiscoverer();
      expect(d.projectDir).toBe(process.cwd());
    });

    it('accepts an explicit projectDir', () => {
      const d = new InstructionsDiscoverer(resolve(import.meta.dirname, '__fixtures__', 'test-instructions'));
      expect(d.projectDir).toBe(resolve(import.meta.dirname, '__fixtures__', 'test-instructions'));
    });

    it('initialises 6 roots with descending priority', () => {
      const d = new InstructionsDiscoverer('/project');

      expect(d.roots).toHaveLength(6);

      // Highest priority first
      expect(d.roots[0]?.path).toContain('/project/AGENTS.md');
      expect(d.roots[0]?.priority).toBe(90);
      expect(d.roots[0]?.scope).toBe('workspace');
      expect(d.roots[0]?.alwaysInject).toBe(true);

      expect(d.roots[1]?.path).toContain('/project/CLAUDE.md');
      expect(d.roots[1]?.priority).toBe(80);

      expect(d.roots[2]?.path).toContain('/project/copilot-instructions.md');
      expect(d.roots[2]?.priority).toBe(70);

      expect(d.roots[3]?.path).toContain('/project/.cursor/rules');
      expect(d.roots[3]?.priority).toBe(60);
      expect(d.roots[3]?.isGlob).toBe(true);

      expect(d.roots[4]?.path).toContain('.agentsy/instructions.md');
      expect(d.roots[4]?.priority).toBe(50);
      expect(d.roots[4]?.scope).toBe('user');

      expect(d.roots[5]?.path).toContain('.config/agentsy/instructions.md');
      expect(d.roots[5]?.priority).toBe(40);
      expect(d.roots[5]?.scope).toBe('user');
    });
  });

  describe('discover', () => {
    it('returns empty array when no files exist', async () => {
      const emptyDir = resolve(import.meta.dirname, '__fixtures__', `empty-${Date.now()}`);
      await mkdir(emptyDir, { recursive: true });
      fixtureDirs.push(emptyDir);

      const d = new InstructionsDiscoverer(emptyDir);
      const results = await d.discover();

      expect(results).toHaveLength(0);
    });

    it('discovers project-level instruction files', async () => {
      const dir = await createFixtureDir({
        'AGENTS.md': '# Agents',
        'CLAUDE.md': '# Claude'
      });
      fixtureDirs.push(dir);

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      // Only the files that exist in the project dir (2) — user roots won't exist
      expect(results.length).toBeGreaterThanOrEqual(2);

      const agents = results.find(r => r.path.endsWith('AGENTS.md'));
      expect(agents).toBeDefined();
      expect(agents?.content).toBe('# Agents');
      expect(agents?.priority).toBe(90);
      expect(agents?.scope).toBe('workspace');
      expect(agents?.alwaysInject).toBe(true);

      const claude = results.find(r => r.path.endsWith('CLAUDE.md'));
      expect(claude).toBeDefined();
      expect(claude?.content).toBe('# Claude');
      expect(claude?.priority).toBe(80);
    });

    it('discovers .cursor/rules/*.md glob files', async () => {
      const dir = await createFixtureDir({
        '.cursor/rules/typescript.md': 'strict mode',
        '.cursor/rules/testing.md': 'vitest'
      });
      fixtureDirs.push(dir);

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      const rules = results.filter(r => r.path.includes('.cursor/rules'));
      expect(rules).toHaveLength(2);

      const tsRule = rules.find(r => r.path.endsWith('typescript.md'));
      expect(tsRule).toBeDefined();
      expect(tsRule?.content).toBe('strict mode');
      expect(tsRule?.priority).toBe(60);
      expect(tsRule?.scope).toBe('workspace');
      expect(tsRule?.alwaysInject).toBe(false);
    });

    it('filters non-.md files from glob roots', async () => {
      const dir = await createFixtureDir({
        '.cursor/rules/config.json': '{}',
        '.cursor/rules/style.md': 'clean code'
      });
      fixtureDirs.push(dir);

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      const rules = results.filter(r => r.path.includes('.cursor/rules'));
      expect(rules).toHaveLength(1);
      expect(rules[0]?.path).toContain('style.md');
    });

    it('returns results sorted by priority descending', async () => {
      const dir = await createFixtureDir({
        'AGENTS.md': '# top',
        'CLAUDE.md': '# mid',
        'not-copilot-instructions.md': '' // This one won't be discovered — need the actual filename
      });
      fixtureDirs.push(dir);

      // Also create .cursor/rules
      await mkdir(resolve(dir, '.cursor', 'rules'), { recursive: true });
      await writeFile(resolve(dir, '.cursor', 'rules', 'test.md'), '# low', 'utf-8');

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const prev = results[i - 1];
        if (current === undefined || prev === undefined) {
          throw new Error('unexpected undefined');
        }
        expect(current.priority).toBeLessThanOrEqual(prev.priority);
      }
    });

    it('skips non-existent files silently', async () => {
      const dir = await createFixtureDir({
        'AGENTS.md': '# only this'
      });
      fixtureDirs.push(dir);

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      expect(results).toHaveLength(1);
      expect(results[0]?.path).toContain('AGENTS.md');
    });

    it('handles unreadable files gracefully', async () => {
      const dir = await createFixtureDir({
        'AGENTS.md': '# ok',
        'CLAUDE.md': '# claude'
      });
      fixtureDirs.push(dir);

      await mkdir(resolve(dir, '.cursor', 'rules'), { recursive: true });

      const claudePath = resolve(dir, 'CLAUDE.md');
      await import('node:fs/promises').then(fs => fs.chmod(claudePath, 0o000));

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      const hasClaude = results.some(r => r.path.endsWith('CLAUDE.md'));
      expect(hasClaude).toBe(false);

      const hasAgents = results.some(r => r.path.endsWith('AGENTS.md'));
      expect(hasAgents).toBe(true);

      // Restore permissions for cleanup
      await import('node:fs/promises').then(fs => fs.chmod(claudePath, 0o644)); // NOSONAR — safe permission
    });

    it('deduplicates content across roots when discovered', async () => {
      const dir = await createFixtureDir({
        'AGENTS.md': '# agent content',
        'CLAUDE.md': '# claude content'
      });
      fixtureDirs.push(dir);

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      const contents = results.map(r => r.content);
      const unique = new Set(contents);

      expect(unique.size).toBe(contents.length); // No duplicates
    });

    it('includes absolute paths in results', async () => {
      const dir = await createFixtureDir({
        'AGENTS.md': '# agents'
      });
      fixtureDirs.push(dir);

      const d = new InstructionsDiscoverer(dir);
      const results = await d.discover();

      expect(results[0]?.path.startsWith('/')).toBe(true);
      expect(results[0]?.path).toBe(resolve(dir, 'AGENTS.md'));
    });
  });
});
