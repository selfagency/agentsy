import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkTrustedPublishReadiness,
  getRepositoryField,
  normalizeRepositoryValue,
  validateRepositoryMatch
} from './trusted-publish-readiness.ts';

function setupBase() {
  const base = mkdtempSync(join(tmpdir(), 'agentsy-trusted-publish-'));
  const pkgDir = join(base, 'packages', 'testpkg');
  const workflowsDir = join(base, '.github', 'workflows');
  const releaseStatePath = join(base, 'config', 'release-state.json');

  mkdirSync(pkgDir, { recursive: true });
  mkdirSync(workflowsDir, { recursive: true });
  mkdirSync(join(base, 'config'), { recursive: true });

  writeFileSync(join(workflowsDir, 'release.yml'), 'name: release\n');

  return { base, pkgDir, releaseStatePath };
}

describe('trusted-publish-readiness', () => {
  it('normalizeRepositoryValue handles common git URL forms', () => {
    expect(normalizeRepositoryValue('https://github.com/selfagency/agentsy.git')).toEqual('selfagency/agentsy');
    expect(normalizeRepositoryValue('git+https://github.com/selfagency/agentsy.git')).toEqual('selfagency/agentsy');
    expect(normalizeRepositoryValue('git@github.com:selfagency/agentsy.git')).toEqual('selfagency/agentsy');
  });

  it('getRepositoryField supports string and object forms', () => {
    expect(getRepositoryField('https://github.com/selfagency/agentsy.git')).toEqual(
      'https://github.com/selfagency/agentsy.git'
    );
    expect(getRepositoryField({ url: 'git@github.com:selfagency/agentsy.git' })).toEqual(
      'git@github.com:selfagency/agentsy.git'
    );
    expect(getRepositoryField({})).toEqual('');
  });

  it('validateRepositoryMatch returns failure for mismatch', () => {
    const result = validateRepositoryMatch('https://github.com/selfagency/wrong.git', 'selfagency/agentsy');
    expect(result.ok).toEqual(false);
  });

  it('checkTrustedPublishReadiness passes for oidc-ready package with matching repo', () => {
    const { base, pkgDir, releaseStatePath } = setupBase();

    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@agentsy/testpkg', repository: { url: 'https://github.com/selfagency/agentsy.git' } })
    );

    writeFileSync(
      releaseStatePath,
      JSON.stringify({ defaultState: 'bootstrap-required', packages: { '@agentsy/testpkg': 'oidc-ready' } })
    );

    const result = checkTrustedPublishReadiness({
      packageName: '@agentsy/testpkg',
      packageDir: pkgDir,
      expectedRepo: 'selfagency/agentsy',
      releaseStatePath,
      workflowFilename: 'release.yml',
      rootDir: base
    });

    expect(result).toEqual({ ok: true });
  });

  it('checkTrustedPublishReadiness fails for bootstrap-required package', () => {
    const { base, pkgDir, releaseStatePath } = setupBase();

    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@agentsy/testpkg', repository: { url: 'https://github.com/selfagency/agentsy.git' } })
    );

    writeFileSync(releaseStatePath, JSON.stringify({ defaultState: 'bootstrap-required', packages: {} }));

    const result = checkTrustedPublishReadiness({
      packageName: '@agentsy/testpkg',
      packageDir: pkgDir,
      expectedRepo: 'selfagency/agentsy',
      releaseStatePath,
      workflowFilename: 'release.yml',
      rootDir: base
    });

    expect(result.ok).toEqual(false);
  });

  it('checkTrustedPublishReadiness fails when workflow file is missing under provided rootDir', () => {
    const { base, pkgDir, releaseStatePath } = setupBase();

    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@agentsy/testpkg', repository: { url: 'https://github.com/selfagency/agentsy.git' } })
    );

    writeFileSync(
      releaseStatePath,
      JSON.stringify({ defaultState: 'bootstrap-required', packages: { '@agentsy/testpkg': 'oidc-ready' } })
    );

    const result = checkTrustedPublishReadiness({
      packageName: '@agentsy/testpkg',
      packageDir: pkgDir,
      expectedRepo: 'selfagency/agentsy',
      releaseStatePath,
      workflowFilename: 'missing.yml',
      rootDir: base
    });

    expect(result.ok).toEqual(false);
  });
});
