import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { SkillActivator } from './activator.js';
import type { SkillMetadata } from './manifest.js';

/**
 * Create a temporary fixture directory with skill files.
 */
async function createFixtureDir(files: Record<string, string>): Promise<string> {
  const dir = resolve(import.meta.dirname, '__fixtures__', `activ-${Date.now()}`);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = resolve(dir, relativePath);
    await mkdir(resolve(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }
  return dir;
}

/**
 * Remove a fixture directory.
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

// --------------- Helpers ---------------

function makeMeta(
  overrides: Partial<SkillMetadata> & { name: string; description: string; path: string }
): SkillMetadata {
  return {
    name: overrides.name,
    description: overrides.description,
    path: overrides.path,
    ...(overrides.author ? { author: overrides.author } : {}),
    ...(overrides.version ? { version: overrides.version } : {}),
    ...(overrides.license ? { license: overrides.license } : {})
  };
}

// --------------- Tests ---------------

describe('SkillActivator', () => {
  describe('constructor', () => {
    it('applies default options when none are provided', () => {
      const a = new SkillActivator();
      expect(a.options.threshold).toBe(0.1);
      expect(a.options.nameWeight).toBe(0.6);
    });

    it('merges provided options with defaults', () => {
      const a = new SkillActivator({ threshold: 0.5 });
      expect(a.options.threshold).toBe(0.5);
      expect(a.options.nameWeight).toBe(0.6);
    });

    it('accepts all options', () => {
      const a = new SkillActivator({ threshold: 0.3, nameWeight: 0.8 });
      expect(a.options.threshold).toBe(0.3);
      expect(a.options.nameWeight).toBe(0.8);
    });
  });

  describe('activate', () => {
    it('returns empty array for empty metadata', async () => {
      const a = new SkillActivator();
      const result = await a.activate('hello', []);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty message', async () => {
      const a = new SkillActivator();
      const meta = [makeMeta({ name: 'test', description: 'A test skill', path: '/tmp' })];
      const result = await a.activate('', meta);
      expect(result).toEqual([]);
    });

    it('returns empty array for message with only stop words', async () => {
      const a = new SkillActivator();
      const meta = [makeMeta({ name: 'test', description: 'A test skill', path: '/tmp' })];
      const result = await a.activate('the and for are', meta);
      expect(result).toEqual([]);
    });

    it('loads a skill body from SKILL.md and returns ActiveSkill', async () => {
      const dir = await createFixtureDir({
        '.agents/build-skill/SKILL.md':
          '---\nname: build-skill\ndescription: Build automation skill\n---\n\n# Build Skill\n\nAutomates builds for projects.'
      });
      fixtureDirs.push(dir);

      const skillDir = resolve(dir, '.agents', 'build-skill');
      const meta = [makeMeta({ name: 'build-skill', description: 'Build automation skill', path: skillDir })];

      const a = new SkillActivator({ threshold: 0 });
      const result = await a.activate('build automation', meta);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('build-skill');
      expect(result[0]?.description).toBe('Build automation skill');
      expect(result[0]?.body).toContain('Build Skill');
      expect(result[0]?.score).toBeGreaterThan(0);
      expect(result[0]?.tokenCount).toBeGreaterThan(0);
    });

    it('returns skills ordered by relevance (highest first)', async () => {
      const dir = await createFixtureDir({
        '.agents/git-help/SKILL.md':
          '---\nname: git-help\ndescription: Git and version control helper\n---\n\nGit commands and workflows.',
        '.agents/build-tool/SKILL.md':
          '---\nname: build-tool\ndescription: Build system integrations\n---\n\nBuild tools like make and gradle.',
        '.agents/deploy-help/SKILL.md':
          '---\nname: deploy-help\ndescription: Deployment and CI/CD pipelines\n---\n\nDeploy to production.'
      });
      fixtureDirs.push(dir);

      const meta: SkillMetadata[] = [
        makeMeta({
          name: 'git-help',
          description: 'Git and version control helper',
          path: resolve(dir, '.agents', 'git-help')
        }),
        makeMeta({
          name: 'build-tool',
          description: 'Build system integrations',
          path: resolve(dir, '.agents', 'build-tool')
        }),
        makeMeta({
          name: 'deploy-help',
          description: 'Deployment and CI/CD pipelines',
          path: resolve(dir, '.agents', 'deploy-help')
        })
      ];

      const a = new SkillActivator({ threshold: 0 });
      const result = await a.activate('deploy to production with ci cd pipelines', meta);

      expect(result.length).toBeGreaterThanOrEqual(1);
      // deploy-help should be first (best match for "deploy" + "pipelines")
      expect(result[0]?.name).toBe('deploy-help');
      expect(result[0]?.score).toBeGreaterThanOrEqual(result[1]?.score ?? 0);
    });

    it('filters skills below the threshold', async () => {
      const meta: SkillMetadata[] = [
        makeMeta({
          name: 'git-helper',
          description: 'Version control with git',
          path: resolve(import.meta.dirname, '__fixtures__', 'git')
        }),
        makeMeta({
          name: 'weather-bot',
          description: 'Weather forecasts and climate data',
          path: resolve(import.meta.dirname, '__fixtures__', 'weather')
        })
      ];

      const a = new SkillActivator({ threshold: 0.25 });
      const result = await a.activate('version control git stuff', meta);

      // Only git-helper should pass with a score high enough
      const names = result.map(r => r.name);
      expect(names).toContain('git-helper');
      expect(names).not.toContain('weather-bot');
    });

    it('loads body from SKILL.md on the skill path', async () => {
      const dir = await createFixtureDir({
        '.agents/my-skill/SKILL.md': '---\nname: my-skill\ndescription: My awesome skill\n---\n\nFull skill body here.'
      });
      fixtureDirs.push(dir);

      const skillDir = resolve(dir, '.agents', 'my-skill');
      const meta = [makeMeta({ name: 'my-skill', description: 'My awesome skill', path: skillDir })];

      const a = new SkillActivator({ threshold: 0 });
      const result = await a.activate('awesome', meta);

      expect(result).toHaveLength(1);
      expect(result[0]?.body).toBe('---\nname: my-skill\ndescription: My awesome skill\n---\n\nFull skill body here.');
    });

    it('returns empty body when no skill file exists', async () => {
      const a = new SkillActivator({ threshold: 0 });
      const meta = [makeMeta({ name: 'missing', description: 'Has no file on disk', path: 'nowhere' })];

      const result = await a.activate('missing', meta);

      expect(result).toHaveLength(1);
      expect(result[0]?.body).toBe('');
    });

    it('handles case-insensitive matching', async () => {
      const meta: SkillMetadata[] = [
        makeMeta({ name: 'Docker-Manager', description: 'Container management and orchestration', path: 'docker' })
      ];

      const a = new SkillActivator({ threshold: 0.1 });
      const result = await a.activate('DOCKER CONTAINER ORCHESTRATION', meta);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Docker-Manager');
    });

    it('computes tokenCount as ceil(body.length / 4)', async () => {
      const bodyContent = `${'x'.repeat(100)}`;
      const dir = await createFixtureDir({
        '.agents/skill-a/SKILL.md': bodyContent
      });
      fixtureDirs.push(dir);

      const skillDir = resolve(dir, '.agents', 'skill-a');
      const meta = [makeMeta({ name: 'skill-a', description: 'A skill', path: skillDir })];

      const a = new SkillActivator({ threshold: 0 });
      const result = await a.activate('skill', meta);

      expect(result[0]?.tokenCount).toBe(Math.ceil(100 / 4));
    });
  });
});
