import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { getPackageReleaseState, readReleaseState } from './release-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

/** @param {unknown} repository */
export function getRepositoryField(repository: unknown): string {
  if (typeof repository === 'string') {
    return repository;
  }

  if (repository && typeof repository === 'object' && 'url' in repository && typeof repository.url === 'string') {
    return repository.url;
  }

  return '';
}

/** @param {string} value */
export function normalizeRepositoryValue(value: string): string {
  return String(value)
    .replace(/^git\+/, '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .trim();
}

/**
 * @param {string} pkgRepoValue
 * @param {string} expectedRepo
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateRepositoryMatch(
  pkgRepoValue: string,
  expectedRepo: string
): { ok: true } | { ok: false; error: string } {
  const normalizedPkgRepo = normalizeRepositoryValue(pkgRepoValue);
  const normalizedExpectedRepo = normalizeRepositoryValue(expectedRepo);

  if (normalizedPkgRepo !== normalizedExpectedRepo) {
    return {
      ok: false,
      error:
        `Release blocked: package repository.url must match '${normalizedExpectedRepo}' for npm trusted publishing. ` +
        `Current value resolves to '${normalizedPkgRepo || '(empty)'}'.`
    };
  }

  return { ok: true };
}

/**
 * @param {{
 *   packageName: string,
 *   packageDir: string,
 *   expectedRepo: string,
 *   releaseStatePath: string,
 *   expectedState?: string,
 *   workflowFilename?: string,
 *   rootDir?: string,
 * }} input
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function checkTrustedPublishReadiness(input: {
  packageName: string;
  packageDir: string;
  expectedRepo: string;
  releaseStatePath: string;
  expectedState?: string;
  workflowFilename?: string;
  rootDir?: string;
}): { ok: true } | { ok: false; error: string } {
  const expectedState = input.expectedState ?? 'oidc-ready';
  const workflowFilename = input.workflowFilename ?? 'release.yml';

  const state = readReleaseState(input.releaseStatePath);
  const packageState = getPackageReleaseState(state, input.packageName);
  if (packageState !== expectedState) {
    return {
      ok: false,
      error:
        `Release blocked: ${input.packageName} is '${packageState}', not '${expectedState}'. ` +
        `Bootstrap publish once locally, configure npm trusted publisher, then update config/release-state.json.`
    };
  }

  const pkgJsonPath = resolve(input.packageDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return { ok: false, error: `Release blocked: package.json not found at ${pkgJsonPath}` };
  }

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { repository?: unknown };
  const repoCheck = validateRepositoryMatch(getRepositoryField(pkg.repository), input.expectedRepo);
  if (!repoCheck.ok) {
    return repoCheck;
  }

  const workflowPath = resolve(input.rootDir ?? ROOT, '.github', 'workflows', workflowFilename);
  if (!existsSync(workflowPath)) {
    return {
      ok: false,
      error: `Release blocked: workflow file '.github/workflows/${workflowFilename}' does not exist.`
    };
  }

  return { ok: true };
}

if (typeof process.argv[1] === 'string' && resolve(process.argv[1]) === __filename) {
  const { values: args } = parseNodeArgs({
    options: {
      'package-name': { type: 'string' },
      'package-dir': { type: 'string' },
      'expected-repo': { type: 'string' },
      'release-state-path': { type: 'string' },
      'workflow-filename': { type: 'string' },
      'expected-state': { type: 'string' },
      'root-dir': { type: 'string' }
    },
    allowPositionals: false
  });

  const packageName = args['package-name'];
  const packageDir = args['package-dir'];
  const expectedRepo = args['expected-repo'];
  const releaseStatePath = args['release-state-path'] ?? resolve(ROOT, 'config', 'release-state.json');
  const workflowFilename = args['workflow-filename'] ?? 'release.yml';
  const expectedState = args['expected-state'] ?? 'oidc-ready';

  if (!packageName || !packageDir || !expectedRepo) {
    console.error(
      'Usage: node scripts/trusted-publish-readiness.js --package-name <name> --package-dir <dir> --expected-repo <owner/repo> [--release-state-path <path>] [--workflow-filename release.yml] [--expected-state oidc-ready]'
    );
    process.exit(1);
  }

  const result = checkTrustedPublishReadiness({
    packageName,
    packageDir: resolve(packageDir),
    expectedRepo,
    releaseStatePath: resolve(releaseStatePath),
    workflowFilename,
    expectedState,
    ...(args['root-dir'] === undefined ? {} : { rootDir: resolve(args['root-dir']) })
  });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(`✅ Trusted publishing readiness checks passed for ${packageName}.`);
}
