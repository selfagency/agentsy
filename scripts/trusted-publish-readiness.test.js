import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkTrustedPublishReadiness,
  getRepositoryField,
  normalizeRepositoryValue,
  validateRepositoryMatch,
} from './trusted-publish-readiness.js';

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

test('normalizeRepositoryValue handles common git URL forms', () => {
  assert.equal(normalizeRepositoryValue('https://github.com/selfagency/agentsy.git'), 'selfagency/agentsy');
  assert.equal(normalizeRepositoryValue('git+https://github.com/selfagency/agentsy.git'), 'selfagency/agentsy');
  assert.equal(normalizeRepositoryValue('git@github.com:selfagency/agentsy.git'), 'selfagency/agentsy');
});

test('getRepositoryField supports string and object forms', () => {
  assert.equal(
    getRepositoryField('https://github.com/selfagency/agentsy.git'),
    'https://github.com/selfagency/agentsy.git',
  );
  assert.equal(
    getRepositoryField({ url: 'git@github.com:selfagency/agentsy.git' }),
    'git@github.com:selfagency/agentsy.git',
  );
  assert.equal(getRepositoryField({}), '');
});

test('validateRepositoryMatch returns failure for mismatch', () => {
  const result = validateRepositoryMatch('https://github.com/selfagency/wrong.git', 'selfagency/agentsy');
  assert.equal(result.ok, false);
});

test('checkTrustedPublishReadiness passes for oidc-ready package with matching repo', () => {
  const { base, pkgDir, releaseStatePath } = setupBase();

  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name: '@agentsy/testpkg', repository: { url: 'https://github.com/selfagency/agentsy.git' } }),
  );

  writeFileSync(
    releaseStatePath,
    JSON.stringify({ defaultState: 'bootstrap-required', packages: { '@agentsy/testpkg': 'oidc-ready' } }),
  );

  const result = checkTrustedPublishReadiness({
    packageName: '@agentsy/testpkg',
    packageDir: pkgDir,
    expectedRepo: 'selfagency/agentsy',
    releaseStatePath,
    workflowFilename: 'release.yml',
    rootDir: base,
  });

  assert.deepEqual(result, { ok: true });
});

test('checkTrustedPublishReadiness fails for bootstrap-required package', () => {
  const { base, pkgDir, releaseStatePath } = setupBase();

  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name: '@agentsy/testpkg', repository: { url: 'https://github.com/selfagency/agentsy.git' } }),
  );

  writeFileSync(releaseStatePath, JSON.stringify({ defaultState: 'bootstrap-required', packages: {} }));

  const result = checkTrustedPublishReadiness({
    packageName: '@agentsy/testpkg',
    packageDir: pkgDir,
    expectedRepo: 'selfagency/agentsy',
    releaseStatePath,
    workflowFilename: 'release.yml',
    rootDir: base,
  });

  assert.equal(result.ok, false);
});

test('checkTrustedPublishReadiness fails when workflow file is missing under provided rootDir', () => {
  const { base, pkgDir, releaseStatePath } = setupBase();

  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name: '@agentsy/testpkg', repository: { url: 'https://github.com/selfagency/agentsy.git' } }),
  );

  writeFileSync(
    releaseStatePath,
    JSON.stringify({ defaultState: 'bootstrap-required', packages: { '@agentsy/testpkg': 'oidc-ready' } }),
  );

  const result = checkTrustedPublishReadiness({
    packageName: '@agentsy/testpkg',
    packageDir: pkgDir,
    expectedRepo: 'selfagency/agentsy',
    releaseStatePath,
    workflowFilename: 'missing.yml',
    rootDir: base,
  });

  assert.equal(result.ok, false);
});
