import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RELEASE_STATE, getPackageReleaseState, readReleaseState, writeReleaseState } from './release-state.ts';

describe('release-state', () => {
  it('readReleaseState returns defaults when file is missing', () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-release-state-'));
    const p = join(base, 'release-state.json');

    const state = readReleaseState(p);
    expect(state.defaultState).toEqual(DEFAULT_RELEASE_STATE);
    expect(state.packages).toEqual({});
  });

  it('getPackageReleaseState falls back to default', () => {
    const state = {
      defaultState: 'bootstrap-required',
      packages: {
        '@agentsy/vscode': 'oidc-ready',
      },
    };

    expect(getPackageReleaseState(state, '@agentsy/vscode')).toEqual('oidc-ready');
    expect(getPackageReleaseState(state, '@agentsy/processor')).toEqual('bootstrap-required');
  });

  it('writeReleaseState writes sorted package keys', () => {
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
    expect(Object.keys(written.packages)).toEqual(['@agentsy/a', '@agentsy/z']);
  });

  it('readReleaseState tolerates invalid structure', () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-release-state-'));
    const p = join(base, 'release-state.json');
    writeFileSync(p, JSON.stringify({ defaultState: 12, packages: [] }));

    const state = readReleaseState(p);
    expect(state.defaultState).toEqual(DEFAULT_RELEASE_STATE);
    expect(state.packages).toEqual({});
  });

  it('readReleaseState tolerates malformed JSON by returning defaults', () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-release-state-'));
    const p = join(base, 'release-state.json');
    writeFileSync(p, '{"defaultState":');

    const state = readReleaseState(p);
    expect(state.defaultState).toEqual(DEFAULT_RELEASE_STATE);
    expect(state.packages).toEqual({});
  });
});
