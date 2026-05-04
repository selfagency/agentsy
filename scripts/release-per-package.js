#!/usr/bin/env zx
/**
 * Per-package release orchestrator for monorepo.
 *
 * Usage: pnpm release <package-name> <version> [--dry-run]
 *
 * Examples:
 *   pnpm release @agentsy/core 0.2.0
 *   pnpm release @agentsy/vscode 0.1.5 --dry-run
 *
 * Flow:
 *   1.  Parse package name and version arguments.
 *   2.  Validate version format and resolve package directory.
 *   3.  Validate prerequisites (git clean, on main, npm auth, GitHub token).
 *   4.  Generate release notes via GitHub API.
 *   5.  Update package.json and CHANGELOG.md for that package.
 *   6.  Commit and push to main.
 *   7.  Wait for "Test & Build" workflow to pass.
 *   8.  Create annotated tag: @scope/package@version
 *   9.  Push tag to origin (triggers Release workflow).
 *   10. Poll Release workflow until completion.
 *   11. Done (npm publish handled by GitHub Actions).
 *
 * Rollback on failure:
 *   - Deletes remote tag if pushed.
 *   - Reverts or resets commits as appropriate.
 */

// Disable husky to avoid pre-push hooks during release.
process.env.HUSKY = '0';

import { Octokit } from '@octokit/rest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';
import { $, argv, cd, sleep } from 'zx';

$.verbose = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const RELEASE_STATE_PATH = resolve(ROOT, 'config', 'release-state.json');
cd(ROOT);

// Defensive filesystem helpers
function isPathInsideRoot(p) {
  try {
    const resolved = resolve(p);
    const rel = relative(ROOT, resolved);
    return rel === '' || (!rel.startsWith('..') && !rel.startsWith('../'));
  } catch {
    return false;
  }
}

function safeRead(p, enc = 'utf8') {
  if (!isPathInsideRoot(p)) throw new Error(`Refusing to read outside repository root: ${p}`);
  return readFileSync(resolve(p), enc);
}

function safeWrite(p, data) {
  if (!isPathInsideRoot(p)) throw new Error(`Refusing to write outside repository root: ${p}`);
  return writeFileSync(resolve(p), data);
}

function readReleaseState() {
  if (!existsSync(RELEASE_STATE_PATH)) {
    return { defaultState: 'bootstrap-required', packages: {} };
  }

  const raw = JSON.parse(safeRead(RELEASE_STATE_PATH, 'utf8'));
  const defaultState =
    raw && typeof raw === 'object' && typeof raw.defaultState === 'string' ? raw.defaultState : 'bootstrap-required';
  const packages =
    raw && typeof raw === 'object' && raw.packages && typeof raw.packages === 'object' ? raw.packages : {};

  return { defaultState, packages };
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const packageName = argv._[0];
const version = argv._[1];
const isDryRun = argv['dry-run'] || argv.dryRun;

if (!packageName || !version) {
  console.error('Usage: pnpm release <package-name> <version> [--dry-run]');
  console.error('');
  console.error('Examples:');
  console.error('  pnpm release @agentsy/core 0.2.0');
  console.error('  pnpm release @agentsy/vscode 0.1.5 --dry-run');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version)) {
  console.error(`❌ Invalid version: "${version}". Expected semver (e.g. 1.2.3 or 1.2.3-beta.1)`);
  process.exit(1);
}

// Resolve package directory
const PACKAGES_DIR = resolve(ROOT, 'packages');

// Normalize short names (e.g., "core" -> "@agentsy/core")
const normalizedPackageName = packageName.includes('/')
  ? packageName
  : `@agentsy/${packageName}`;

const pkgShortName = normalizedPackageName.replace(/^@[^/]+\//, '');
const pkgDir = resolve(PACKAGES_DIR, pkgShortName);
const pkgJsonPath = resolve(pkgDir, 'package.json');

if (!existsSync(pkgDir)) {
  console.error(`❌ Package directory not found: ${pkgDir}`);
  console.error(`   Available packages: @agentsy/core, @agentsy/vscode`);
  process.exit(1);
}

if (!existsSync(pkgJsonPath)) {
  console.error(`❌ package.json not found at: ${pkgJsonPath}`);
  process.exit(1);
}

// Load actual package name from package.json
const pkgJson = JSON.parse(safeRead(pkgJsonPath, 'utf8'));
const fullPackageName = pkgJson.name;

const releaseState = readReleaseState();
const packageReleaseState = releaseState.packages[fullPackageName] ?? releaseState.defaultState;

if (packageReleaseState !== 'oidc-ready') {
  console.error(`❌ ${fullPackageName} is '${packageReleaseState}', not 'oidc-ready'.`);
  console.error('   This package must be bootstrap-published locally once before CI OIDC publishing is allowed.');
  console.error(`   Run: pnpm bootstrap-release ${fullPackageName} ${version} --yes-i-know-this-is-first-publish`);
  process.exit(1);
}

const tag = `${fullPackageName}@${version}`;

// ---------------------------------------------------------------------------
// Rollback state
// ---------------------------------------------------------------------------

let commitLocal = false;
let commitPushed = false;
let tagPushed = false;
let releaseDone = false;
let gitCmd = 'git';

function runGit(args, options = {}) {
  const result = spawnSync(gitCmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `git ${args.join(' ')} failed with exit code ${result.status}`;
    throw new Error(details);
  }

  return result;
}

function resolveGitExecutable() {
  const direct = spawnSync('git', ['--version'], { stdio: 'ignore', shell: false });
  if (direct.status === 0) return 'git';

  const locatorCommand = process.platform === 'win32' ? 'where' : 'which';
  const located = spawnSync(locatorCommand, ['git'], { encoding: 'utf8', shell: false });
  if (located.status === 0) {
    const candidate = located.stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean);
    if (candidate) return candidate;
  }

  return null;
}

async function rollback() {
  if (releaseDone) return;

  $.verbose = false;
  try {
    if (tagPushed) {
      console.log(`\n⚠️  Release interrupted. Deleting remote tag ${tag}...`);
      try {
        runGit(['push', 'origin', '--delete', tag]);
        runGit(['tag', '-d', tag]);
        console.log(`↩️  Tag ${tag} deleted.`);
      } catch {
        console.error(`⚠️  Could not delete tag ${tag}. Manually run:`);
        console.error(`   git push origin --delete '${tag}' && git tag -d '${tag}'`);
      }
    }

    if (commitPushed) {
      console.log('\n⚠️  Reverting release commit on origin/main...');
      try {
        runGit(['revert', '--no-edit', 'HEAD']);
        runGit(['push', 'origin', 'main']);
        console.log('↩️  Commit reverted and pushed.');
      } catch {
        console.error('❌ Auto-revert failed. Manually run:');
        console.error('   git revert HEAD && git push origin main');
      }
    } else if (commitLocal) {
      console.log('\n⚠️  Resetting local release commit...');
      try {
        runGit(['reset', '--hard', 'HEAD~1']);
        console.log('↩️  Commit removed.');
      } catch {
        console.error('❌ Reset failed. Manually run: git reset --hard HEAD~1');
      }
    }
  } catch {
    /* best effort */
  }
}

process.on('SIGINT', async () => {
  await rollback();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await rollback();
  process.exit(143);
});

// ---------------------------------------------------------------------------
// Prerequisite helpers
// ---------------------------------------------------------------------------

async function checkNpmCredentials(npmRegistry) {
  try {
    const registry = String(npmRegistry).trim();
    await $`npm whoami --registry=${registry}`;
  } catch {
    console.error(`❌ Not logged in to npm (registry: ${npmRegistry}).`);
    console.error('   Tips:');
    console.error('   - Run: npm login --registry=https://registry.npmjs.org/');
    console.error('   - Or: export NPM_TOKEN="npm_xxx..."');
    process.exit(1);
  }
}

async function resolveGithubToken() {
  let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
  if (!token) {
    try {
      token = (await $`gh auth token`).stdout.trim();
    } catch {
      console.error('❌ No GitHub token found. Set GH_TOKEN/GITHUB_TOKEN or run: gh auth login');
      process.exit(1);
    }
  }
  return token;
}

function updateChangelogFile(changelogPath, heading, releaseNotes, previousTag, tag) {
  let original;
  try {
    original = safeRead(changelogPath, 'utf8');
  } catch {
    original = '# Changelog\n\n## [Unreleased]\n';
  }

  if (original.includes(heading)) {
    console.log('ℹ️  CHANGELOG already contains this release heading; skipping.');
    return;
  }

  const sourceLine = previousTag ? `\n\n_Source: changes from ${previousTag} to ${tag}._` : '';
  const section = `\n${heading}\n\n${releaseNotes}${sourceLine}\n`;
  const marker = '## [Unreleased]';
  const idx = original.indexOf(marker);
  const updated =
    idx >= 0
      ? `${original.slice(0, idx + marker.length)}\n${section}${original.slice(idx + marker.length)}`
      : `${original}\n${section}`;
  safeWrite(changelogPath, updated);
}

// ---------------------------------------------------------------------------
// Main release orchestration
// ---------------------------------------------------------------------------

async function main() {
  // --- Prerequisites -------------------------------------------------------

  const resolvedGit = resolveGitExecutable();
  if (!resolvedGit) {
    console.error("❌ 'git' is required but not found in PATH.");
    process.exit(1);
  }
  gitCmd = resolvedGit;

  process.env.NPM_CONFIG_USERCONFIG ||= resolve(homedir(), '.npmrc');
  const NPM_REGISTRY = process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmjs.org/';

  await checkNpmCredentials(NPM_REGISTRY);

  const githubToken = await resolveGithubToken();
  const octokit = new Octokit({ auth: githubToken });

  // --- Precondition checks -------------------------------------------------

  const dirty = runGit(['status', '--porcelain']).stdout.trim();
  if (dirty) {
    console.error('❌ Working tree is not clean. Commit or stash changes first.');
    process.exit(1);
  }

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (branch !== 'main') {
    console.error(`❌ Must run from 'main'. Current branch: ${branch}`);
    process.exit(1);
  }

  console.log('🔄 Fetching latest refs...');
  runGit(['fetch', 'origin', 'main']);
  runGit(['pull', '--ff-only', 'origin', 'main']);

  // Derive owner/repo from git remote
  const remoteUrl = runGit(['remote', 'get-url', 'origin']).stdout.trim();
  const match = remoteUrl.match(/[:/]([^/:]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) {
    console.error(`❌ Cannot parse owner/repo from remote URL: ${remoteUrl}`);
    process.exit(1);
  }
  const [, owner, repo] = match;

  // Check for existing tags
  const localTag = runGit(['tag', '-l', tag]).stdout.trim();
  if (localTag) {
    console.error(`❌ Local tag '${tag}' already exists. Run: git tag -d '${tag}'`);
    process.exit(1);
  }

  try {
    await octokit.git.getRef({ owner, repo, ref: `tags/${tag}` });
    console.error(`❌ Remote tag '${tag}' already exists.`);
    process.exit(1);
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  // --- Previous tag for release notes diff ---------------------------------

  const tagsResp = await octokit.paginate(octokit.git.listMatchingRefs, {
    owner,
    repo,
    ref: 'tags/',
    per_page: 100,
  });

  // Filter tags for this package, sort by semver
  const parseVer = v => {
    const version = v.slice(v.lastIndexOf('@') + 1);
    return version.split('.').map(Number);
  };

  const previousTag =
    tagsResp
      .map(r => r.ref.replace('refs/tags/', ''))
      .filter(t => t.startsWith(`${fullPackageName}@`) && t !== tag)
      .sort((a, b) => {
        const [aMaj = 0, aMin = 0, aPatch = 0] = parseVer(a);
        const [bMaj = 0, bMin = 0, bPatch = 0] = parseVer(b);
        return aMaj - bMaj || aMin - bMin || aPatch - bPatch;
      })
      .at(-1) ?? '';

  // --- Release notes -------------------------------------------------------

  console.log(`📝 Generating release notes for ${tag}...`);

  const releaseNotesOpts = {
    owner,
    repo,
    tag_name: tag,
    target_commitish: 'main',
  };
  if (previousTag) {
    releaseNotesOpts.previous_tag_name = previousTag;
  }

  const notesResp = await octokit.repos.generateReleaseNotes(releaseNotesOpts);
  const releaseNotes = notesResp.data.body?.trim() || '- No notable changes.';

  // --- Update package.json -------------------------------------------------

  console.log(`🧩 Updating ${fullPackageName} to ${version}...`);
  const pkg = JSON.parse(safeRead(pkgJsonPath, 'utf8'));
  pkg.version = version;
  safeWrite(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // --- Update CHANGELOG.md -------------------------------------------------

  console.log('🧩 Updating CHANGELOG.md...');
  const changelogPath = resolve(pkgDir, 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const heading = `## [${version}] - ${date}`;
  updateChangelogFile(changelogPath, heading, releaseNotes, previousTag, tag);

  // --- Commit + push -------------------------------------------------------

  const hasChanges = runGit(
    ['diff', '--name-only', '--', resolve(pkgDir, 'package.json'), resolve(pkgDir, 'CHANGELOG.md')]
  ).stdout.trim();

  if (hasChanges) {
    console.log('📦 Committing release metadata...');
    runGit(['add', resolve(pkgDir, 'package.json'), resolve(pkgDir, 'CHANGELOG.md')]);
    runGit(['commit', '-m', `chore(release): ${tag}`]);
    commitLocal = true;
  } else {
    console.log('ℹ️  No version/changelog changes; nothing to commit.');
  }

  // --- Dry-run exit (BEFORE pushing) ----------------------------------------

  if (isDryRun) {
    console.log(`\n[dry-run] Would perform the following:`);
    console.log(`[dry-run]   1. Commit: "chore(release): ${tag}"`);
    console.log(`[dry-run]   2. Push to origin/main`);
    console.log(`[dry-run]   3. Wait for Test & Build workflow to pass`);
    console.log(`[dry-run]   4. Create tag: ${tag}`);
    console.log(`[dry-run]   5. Trigger GitHub Release workflow`);
    console.log(`[dry-run]   6. Publish to npm`);
    console.log(`[dry-run]`);
    console.log(`[dry-run] Release notes preview:`);
    console.log(`[dry-run] ${releaseNotes}`);
    return;
  }

  console.log('🚀 Pushing main...');
  runGit(['push', 'origin', 'main']);
  commitPushed = true;
  commitLocal = false;

  // Capture pushed commit SHA
  const headSha = runGit(['rev-parse', 'HEAD']).stdout.trim();

  // --- Wait for required workflows -----------------------------------------

  console.log(`🔎 Waiting for workflows on ${headSha.slice(0, 7)}...`);
  await sleep(10_000);

  const spinner = ora('Test & Build: queued').start();
  await waitForWorkflow(octokit, 'Test & Build', owner, repo, headSha, spinner);

  // --- Tag + push ----------------------------------------------------------

  console.log(`🏷️  Creating annotated tag '${tag}'...`);
  const tagMessage = [
    `Release ${tag}`,
    releaseNotes,
    previousTag ? `Source: changes from ${previousTag} to ${tag}.` : '',
    `Target commit: ${headSha}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  runGit(['tag', '-a', tag, headSha, '-m', tagMessage]);

  console.log(`🚀 Pushing tag '${tag}'...`);
  runGit(['push', 'origin', tag]);
  tagPushed = true;

  // --- Monitor Release workflow --------------------------------------------

  spinner.text = 'Release: waiting for workflow to trigger...';
  spinner.start();
  await waitForWorkflow(octokit, 'Release', owner, repo, headSha, spinner, {
    autoDispatch: false,
    branch: null,
  });

  console.log(`✅ Release workflow complete: ${tag}`);
  releaseDone = true;
}

// ---------------------------------------------------------------------------
// Workflow polling
// ---------------------------------------------------------------------------

async function waitForWorkflow(
  octokit,
  name,
  owner,
  repo,
  headSha,
  spinner,
  { timeoutMs = 3_600_000, pollMs = 15_000, branch = 'main' } = {}
) {
  const workflowsResp = await octokit.actions.listRepoWorkflows({ owner, repo, per_page: 100 });
  const workflow = workflowsResp.data.workflows.find(w => w.name === name);
  if (!workflow) {
    spinner.fail(`${name}: workflow not found`);
    throw new Error(`[${name}] workflow not found in ${owner}/${repo}`);
  }

  const deadline = Date.now() + timeoutMs;
  const cancelledRunIds = new Set();

  while (Date.now() < deadline) {
    const runsResp = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflow.id,
      ...(branch ? { branch } : {}),
      head_sha: headSha,
      per_page: 10,
    });

    const run = runsResp.data.workflow_runs.find(r => !cancelledRunIds.has(r.id));

    if (!run) {
      spinner.text = `${name}: waiting for workflow run...`;
    } else if (run.status !== 'completed') {
      const elapsed = Math.round((Date.now() - new Date(run.created_at).getTime()) / 1000);
      spinner.text = `${name}: ${run.status} (${elapsed}s)`;
    } else if (run.conclusion === 'success') {
      spinner.succeed(`${name}: passed`);
      return;
    } else if (run.conclusion === 'cancelled') {
      cancelledRunIds.add(run.id);
      spinner.text = `${name}: (cancelled run skipped)`;
    } else {
      spinner.fail(`${name}: ${run.conclusion}`);
      throw new Error(`Workflow "${name}" concluded with: ${run.conclusion}`);
    }

    await sleep(pollMs);
  }

  spinner.fail(`${name}: timed out`);
  throw new Error(`Timed out waiting for "${name}".`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch(async error => {
  process.stdout.write('\n');
  console.error(error instanceof Error ? error.message : error);
  await rollback();
  process.exit(1);
});
