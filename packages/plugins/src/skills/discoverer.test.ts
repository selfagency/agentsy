import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Isolated user home dir for tests — prevents scanning real ~/.agents/ etc. */
const TEST_USER_DIR = resolve(import.meta.dirname, '__fixtures__', 'test-nobody');

import { afterEach, describe, expect, it } from 'vitest';

import { SkillDiscoverer } from './discoverer.js';

/**
 * Create a temporary directory with skill files for testing.
 */
async function createFixtureDir(files: Record<string, string>): Promise<string> {
  const dir = resolve(import.meta.dirname, '__fixtures__', `sdisc-${Date.now()}`);

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

describe('SkillDiscoverer', () => {
  describe('constructor', () => {
    it('defaults projectDir to process.cwd()', () => {
      const d = new SkillDiscoverer();
      expect(d.projectDir).toBe(process.cwd());
    });

    it('accepts an explicit projectDir', () => {
      const d = new SkillDiscoverer(resolve(import.meta.dirname, '__fixtures__', 'test'));
      expect(d.projectDir).toBe(resolve(import.meta.dirname, '__fixtures__', 'test'));
    });

    it('creates 4 roots when bundledDir is omitted', () => {
      const d = new SkillDiscoverer('/project');
      expect(d.roots).toHaveLength(4);
    });

    it('creates 5 roots when bundledDir is provided', () => {
      const d = new SkillDiscoverer('/project', '/usr/share/agentsy/skills');
      expect(d.roots).toHaveLength(5);
    });

    it('places project .agents as the first root', () => {
      const d = new SkillDiscoverer('/project');
      expect(d.roots[0]?.path).toContain('/project/.agents');
    });

    it('places bundled dir as the last root', () => {
      const d = new SkillDiscoverer('/project', '/bundled/skills');
      expect(d.roots.at(-1)?.path).toContain('/bundled/skills');
    });

    it('resolves XDG_DATA_HOME when set', () => {
      const orig = process.env.XDG_DATA_HOME;
      process.env.XDG_DATA_HOME = '/custom/data';
      const d = new SkillDiscoverer('/project');

      const xdgRoot = d.roots.find(r => r.path.includes('/custom/data'));
      expect(xdgRoot?.path).toBe('/custom/data/agentsy/skills');

      if (orig === undefined) {
        delete process.env.XDG_DATA_HOME;
      } else {
        process.env.XDG_DATA_HOME = orig;
      }
    });

    it('falls back to ~/.local/share when XDG_DATA_HOME is unset', () => {
      const orig = process.env.XDG_DATA_HOME;
      delete process.env.XDG_DATA_HOME;

      const d = new SkillDiscoverer('/project', undefined, TEST_USER_DIR);
      const xdgRoot = d.roots[3];
      expect(xdgRoot).toBeDefined();
      expect(xdgRoot?.path).toContain('.local/share/agentsy/skills');

      if (orig !== undefined) {
        process.env.XDG_DATA_HOME = orig;
      }
    });
  });

  describe('discover', () => {
    it('returns empty array when no .agents directory exists', async () => {
      const dir = await createFixtureDir({});
      fixtureDirs.push(dir);
      // Pass no bundled dir so no bundled root is checked
      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      // Silently skip the non-existent bundled root
      const results = await d.discover();
      expect(results).toHaveLength(0);
    });

    it('discovers skills from a project .agents directory', async () => {
      const dir = await createFixtureDir({
        '.agents/skills/test-skill/SKILL.md': '---\nname: test-skill\ndescription: A test skill\nversion: 1.0.0\n---'
      });
      fixtureDirs.push(dir);

      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      expect(results.length).toBeGreaterThanOrEqual(0);
      const skill = results.find(r => r.name === 'test-skill');
      expect(skill).toBeDefined();
      expect(skill?.description).toBe('A test skill');
      expect(skill?.version).toBe('1.0.0');
    });

    it('parses frontmatter fields correctly', async () => {
      const dir = await createFixtureDir({
        '.agents/skills/awesome/SKILL.md':
          '---\nname: awesome-skill\ndescription: Does awesome things\nversion: 0.5.0\nauthor: Dev\nlicense: MIT\n---'
      });
      fixtureDirs.push(dir);

      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      const skill = results.find(r => r.name === 'awesome-skill');
      expect(skill).toBeDefined();
      expect(skill?.description).toBe('Does awesome things');
      expect(skill?.version).toBe('0.5.0');
      expect(skill?.author).toBe('Dev');
      expect(skill?.license).toBe('MIT');
    });

    it('falls back to filename when frontmatter has no name', async () => {
      const dir = await createFixtureDir({
        '.agents/skills/my-skill/SKILL.md': '---\ndescription: No name field\n---'
      });
      fixtureDirs.push(dir);

      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      const skill = results.find(r => r.description === 'No name field');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('SKILL');
    });

    it('parses regular .md files (not just SKILL.md)', async () => {
      const dir = await createFixtureDir({
        '.agents/skills/cool/SKILL.md': '---\nname: cool-skill\ndescription: Cool\n---',
        '.agents/skills/extra/custom.md': '---\nname: extra-skill\ndescription: Extra\n---'
      });
      fixtureDirs.push(dir);

      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      const cool = results.find(r => r.name === 'cool-skill');
      expect(cool).toBeDefined();

      const extra = results.find(r => r.name === 'extra-skill');
      expect(extra).toBeDefined();
    });

    it('skips files without frontmatter', async () => {
      const dir = await createFixtureDir({
        '.agents/skills/plain/SKILL.md': '# Just markdown content\nNo frontmatter here.',
        '.agents/skills/valid/SKILL.md': '---\nname: valid-skill\ndescription: With frontmatter\n---'
      });
      fixtureDirs.push(dir);

      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      const valid = results.find(r => r.name === 'valid-skill');
      expect(valid).toBeDefined();

      const plain = results.find(r => r.name === 'plain');
      expect(plain).toBeUndefined();
    });

    it('preserves root order (project files appear first)', async () => {
      const projectDir = await createFixtureDir({
        '.agents/skills/proj-skill/SKILL.md': '---\nname: proj-skill\ndescription: Project skill\n---'
      });
      fixtureDirs.push(projectDir);

      const d = new SkillDiscoverer(projectDir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      // All results should come from the project root
      expect(results.every(r => r.path === resolve(projectDir, '.agents'))).toBe(true);
    });

    it('handles malformed frontmatter gracefully', async () => {
      const dir = await createFixtureDir({
        '.agents/skills/bad/SKILL.md': '---\nname: bad-skill\ndescription: Has unclosed frontmatter\nversion: 1.0.0'
        // No closing ---
      });
      fixtureDirs.push(dir);

      const d = new SkillDiscoverer(dir, undefined, TEST_USER_DIR);
      const results = await d.discover();

      const bad = results.find(r => r.name === 'bad-skill');
      expect(bad).toBeUndefined();
    });
  });
});
