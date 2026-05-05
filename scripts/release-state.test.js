import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DEFAULT_RELEASE_STATE, getPackageReleaseState, readReleaseState, writeReleaseState } from './release-state.js';

test('readReleaseState returns defaults when file is missing', () => {
  const base = mkdtempSync(join(tmpdir(), 'agentsy-release-state-'));
  const p = join(base, 'release-state.json');

  const state = readReleaseState(p);
  assert.equal(state.defaultState, DEFAULT_RELEASE_STATE);
  assert.deepEqual(state.packages, {});
});

test('getPackageReleaseState falls back to default', () => {
  const state = {
    defaultState: 'bootstrap-required',
    packages: {
      '@agentsy/vscode': 'oidc-ready',
    },
  };

  assert.equal(getPackageReleaseState(state, '@agentsy/vscode'), 'oidc-ready');
  assert.equal(getPackageReleaseState(state, '@agentsy/processor'), 'bootstrap-required');
});

test('writeReleaseState writes sorted package keys', () => {
  const base = mkdtempSync(join(tmpdir(), 'agentsy-release-state-'));
  const p = join(base, 'release-state.json');

  writeReleaseState(p, {
    defaultState: 'bootstrap-required',
    packages: {
      '@agentsy/z': 'oidc-ready',
      '@agentsy/a': 'bootstrap-required',
    },
  });

  const written = JSON.parse(readFileSync(p, 'utf8'));
  assert.deepEqual(Object.keys(written.packages), ['@agentsy/a', '@agentsy/z']);
});

test('readReleaseState tolerates invalid structure', () => {
  const base = mkdtempSync(join(tmpdir(), 'agentsy-release-state-'));
  const p = join(base, 'release-state.json');
  writeFileSync(p, JSON.stringify({ defaultState: 12, packages: [] }));

  const state = readReleaseState(p);
  assert.equal(state.defaultState, DEFAULT_RELEASE_STATE);
  assert.deepEqual(state.packages, {});
});
