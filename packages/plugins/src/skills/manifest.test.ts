import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { SkillManifest, SkillMetadata } from './manifest.js';

describe('SkillManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const manifest: SkillManifest = {
      name: 'my-skill',
      description: 'Does something useful'
    };

    expect(manifest.name).toBe('my-skill');
    expect(manifest.description).toBe('Does something useful');
    expect(manifest.version).toBeUndefined();
    expect(manifest.author).toBeUndefined();
    expect(manifest.license).toBeUndefined();
  });

  it('accepts a full manifest with all optional fields', () => {
    const manifest: SkillManifest = {
      name: 'full-skill',
      description: 'A comprehensive skill with all metadata',
      version: '1.2.3',
      author: 'Test Author',
      license: 'MIT'
    };

    expect(manifest.name).toBe('full-skill');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.author).toBe('Test Author');
    expect(manifest.license).toBe('MIT');
  });

  it('enforces string type on name', () => {
    const manifest: SkillManifest = {
      name: 'test',
      description: 'test'
    };
    expect(typeof manifest.name).toBe('string');
  });

  it('enforces string type on description', () => {
    const manifest: SkillManifest = {
      name: 'test',
      description: 'test'
    };
    expect(typeof manifest.description).toBe('string');
  });
});

describe('SkillMetadata', () => {
  it('accepts a minimal valid metadata entry', () => {
    const meta: SkillMetadata = {
      path: '/some/path',
      name: 'found-skill',
      description: 'A discovered skill'
    };

    expect(meta.path).toBe('/some/path');
    expect(meta.name).toBe('found-skill');
    expect(meta.description).toBe('A discovered skill');
    expect(meta.version).toBeUndefined();
    expect(meta.author).toBeUndefined();
    expect(meta.license).toBeUndefined();
  });

  it('accepts a full metadata entry', () => {
    const meta: SkillMetadata = {
      path: resolve(import.meta.dirname, '__fixtures__', 'skills', 'awesome'),
      name: 'awesome-skill',
      description: 'An awesome discovered skill',
      version: '0.1.0',
      author: 'Skill Dev',
      license: 'Apache-2.0'
    };

    expect(meta.path).toBe(resolve(import.meta.dirname, '__fixtures__', 'skills', 'awesome'));
    expect(meta.version).toBe('0.1.0');
    expect(meta.author).toBe('Skill Dev');
    expect(meta.license).toBe('Apache-2.0');
  });

  it('has readonly semantics', () => {
    const meta: SkillMetadata = {
      path: '/p',
      name: 'n',
      description: 'd'
    };

    // @ts-expect-error - path should be readonly
    meta.path = '/other';
  });
});
