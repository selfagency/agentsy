#!/usr/bin/env zx
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// fallow-ignore-file unused-file
import { Octokit } from '@octokit/rest';
import ora from 'ora';
import { $, argv, cd, ProcessOutput, sleep } from 'zx';

import { createGitHelpers } from './release-git.js';
import {
  checkNpmCredentials,
  resolveGithubToken,
  updateChangelogFile,
  ensureCleanMainBranch,
  syncMainBranch,
  resolveOwnerRepoFromOrigin,
  ensureLocalTagDoesNotExist,
  ensureRemoteTagDoesNotExist,
  waitForWorkflow
} from './release-shared.js';
import type { ReleaseNotesOptions } from './release-shared.js';
import { ROOT, parseVersionArg, safeRead, safeWrite } from './release-utils.js';

$.verbose = false;

cd(ROOT);

const version = parseVersionArg(typeof argv._[0] === 'string' ? argv._[0] : undefined);

const tag = `v${version}`;

// ---------------------------------------------------------------------------
// Rollback state
//   commitLocal  — release commit exists locally but has not been pushed
//   commitPushed — release commit has been pushed to origin/main
//   tagPushed    — tag has been pushed but release workflow has not yet succeeded
//   releaseDone  — release workflow succeeded; nothing to undo
// ---------------------------------------------------------------------------

let commitLocal = false;
let commitPushed = false;
let tagPushed = false;
let releaseDone = false;
const { resolveGitExecutable, runGit, setGitCommand } = createGitHelpers(ROOT);

async function rollback() {
  if (releaseDone) {
    return;
  }
  $.verbose = false;
  try {
    if (tagPushed) {
      console.log(`\n⚠️  Release workflow failed or was interrupted. Deleting remote tag ${tag}...`);
      try {
        runGit(['push', 'origin', '--delete', tag]);
        runGit(['tag', '-d', tag]);
        console.log(`↩️  Tag ${tag} deleted from remote and local.`);
      } catch {
        console.error(`❌ Could not delete tag. Manually run:`);
        console.error(`   git push origin --delete ${tag} && git tag -d ${tag}`);
      }
    }
    if (commitPushed) {
      console.log('\n⚠️  Reverting release commit on origin/main...');
      try {
        runGit(['revert', '--no-edit', 'HEAD']);
        runGit(['push', 'origin', 'main']);
        console.log('↩️  Release commit reverted and pushed. Working tree is clean.');
      } catch {
        console.error('❌ Automatic revert failed. Manually run:');
        console.error('   git revert HEAD && git push origin main');
      }
    } else if (commitLocal) {
      console.log('\n⚠️  Release aborted before push. Resetting local release commit...');
      try {
        runGit(['reset', '--hard', 'HEAD~1']);
        console.log('↩️  Local release commit removed. Working tree restored.');
      } catch {
        console.error('❌ Reset failed. Manually run: git reset --hard HEAD~1');
      }
    }
  } catch {
    /* best effort */
  }
}

process.on('SIGINT', () => {
  rollback()
    .then(() => process.exit(130))
    .catch(() => process.exit(130));
});
process.on('SIGTERM', () => {
  rollback()
    .then(() => process.exit(143))
    .catch(() => process.exit(143));
});

// ---------------------------------------------------------------------------
// Main — wrapped so any unhandled error triggers rollback
// ---------------------------------------------------------------------------

async function main() {
  // --- Prerequisites -------------------------------------------------------

  const resolvedGit = resolveGitExecutable();
  if (!resolvedGit) {
    console.error("❌ 'git' is required but not found in PATH.");
    process.exit(1);
  }
  setGitCommand(resolvedGit);

  // Ensure npm uses the user's ~/.npmrc (tokens) and the public npm registry.
  process.env.NPM_CONFIG_USERCONFIG ??= resolve(homedir(), '.npmrc');
  const NPM_REGISTRY = process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org/';

  // If NPM_TOKEN is provided in the environment, set the npm auth config.
  if (process.env.NPM_TOKEN) {
    const registryUrl = new URL(NPM_REGISTRY);
    const registryHost = registryUrl.hostname;
    process.env[`npm_config__${registryHost}_:_authToken`] = process.env.NPM_TOKEN;
  }

  await checkNpmCredentials(NPM_REGISTRY);

  const githubToken = await resolveGithubToken();
  const octokit = new Octokit({ auth: githubToken });

  // --- Precondition checks --------------------------------------------------
  ensureCleanMainBranch();
  syncMainBranch();

  // Derive owner/repo from the git remote URL.
  const { owner, repo } = resolveOwnerRepoFromOrigin();

  // Check for existing local tag.
  ensureLocalTagDoesNotExist(tag);

  // Check for existing remote tag via the API.
  await ensureRemoteTagDoesNotExist(octokit, owner, repo, tag);

  // --- Previous tag (for release notes diff) --------------------------------

  const tagsResp = await octokit.paginate(octokit.git.listMatchingRefs, {
    owner,
    per_page: 100,
    ref: 'tags/v',
    repo
  });

  const previousTag =
    tagsResp
      .map(r => r.ref.replace('refs/tags/', ''))
      .filter(t => t !== tag)
      .toSorted((a, b) => {
        // biome-ignore lint/correctness/useQwikValidLexicalScope: legitimate usage
        const parse = (v: string): [number, number, number] => {
          const parts = v.replace(/^v/, '').split('.').map(Number);
          return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
        };
        const [aMaj, aMin, aPatch] = parse(a);
        const [bMaj, bMin, bPatch] = parse(b);
        return aMaj - bMaj || aMin - bMin || aPatch - bPatch;
      })
      .at(-1) ?? '';

  // --- Release notes --------------------------------------------------------

  console.log(`📝 Generating release notes for ${tag}...`);

  const releaseNotesOpts: ReleaseNotesOptions = {
    owner,
    repo,
    tag_name: tag,
    target_commitish: 'main'
  };
  if (previousTag) {
    releaseNotesOpts.previous_tag_name = previousTag;
  }

  const notesResp = await octokit.repos.generateReleaseNotes(releaseNotesOpts);
  const releaseNotes = notesResp.data.body?.trim() || '- No notable changes.';

  // --- Update package.json --------------------------------------------------
  console.log(`🧩 Updating package.json to ${version}...`);
  const pkgPath = resolve(ROOT, 'package.json');
  const pkg = JSON.parse(safeRead(pkgPath, 'utf-8')) as {
    version: string;
  };
  pkg.version = version;
  safeWrite(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // --- Update CHANGELOG.md --------------------------------------------------

  console.log('🧩 Updating CHANGELOG.md...');
  const changelogPath = resolve(ROOT, 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const heading = `## [${version}] - ${date}`;
  updateChangelogFile(changelogPath, heading, releaseNotes, previousTag, tag);

  // --- Commit + push --------------------------------------------------------

  const hasChanges = runGit(['diff', '--name-only', '--', 'package.json', 'CHANGELOG.md']).stdout.trim();
  if (hasChanges) {
    console.log('📦 Committing release metadata changes...');
    runGit(['add', 'package.json', 'CHANGELOG.md']);
    runGit(['commit', '-m', `chore(release): update version and changelog for ${tag}`]);
    commitLocal = true;
  } else {
    console.log('ℹ️  No version/changelog changes detected; nothing to commit.');
  }

  console.log('🚀 Pushing main...');
  runGit(['push', 'origin', 'main']);
  commitPushed = true;
  commitLocal = false;

  const headSha = runGit(['rev-parse', 'HEAD']).stdout.trim();

  // --- Wait for required workflows (sequential to avoid concurrent-spinner visual corruption) ------

  const shortSha = headSha.slice(0, 7);
  console.log(`🔎 Waiting for required workflows on ${shortSha}...`);
  // Give GitHub a moment to register the push before we start polling.
  await sleep(10_000);

  const spinner = ora({ text: 'Tests: queued' }).start();
  for (const name of ['Test & Build']) {
    spinner.text = `${name}: queued`;
    spinner.start();
    await waitForWorkflow(octokit, name, owner, repo, headSha, spinner);
  }

  // --- Tag + publish --------------------------------------------------------

  console.log(`🏷️  Creating annotated tag ${tag} at ${headSha}...`);

  const tagMessage = [
    `Release ${tag}`,
    releaseNotes,
    previousTag ? `Source: changes from ${previousTag} to ${tag}.` : '',
    `Target commit: ${headSha}`
  ]
    .filter(Boolean)
    .join('\n\n');

  runGit(['tag', '-a', tag, headSha, '-m', tagMessage]);

  console.log(`🚀 Pushing tag ${tag}...`);
  runGit(['push', 'origin', tag]);
  tagPushed = true;

  // --- Watch the release workflow ------------------------------------------

  spinner.text = 'Release: waiting for workflow to trigger...';
  spinner.start();
  await waitForWorkflow(octokit, 'Release', owner, repo, headSha, spinner, {
    autoDispatch: false
  });

  console.log(`✅ GitHub release complete: ${tag} → ${headSha}`);

  // --- npm publish ----------------------------------------------------------

  console.log('📦 Building package...');
  $.verbose = true;
  await $`pnpm build`;
  await $`node scripts/write-dist-package.js`;
  $.verbose = false;

  const distTag = version.includes('-') ? 'next' : 'latest';
  console.log(`🚀 Publishing ${tag} to npm (dist-tag: ${distTag})...`);
  try {
    // For scoped public packages, --access public is required on first publish; harmless on subsequent publishes.
    const accessFlag = (
      JSON.parse(safeRead(resolve(ROOT, 'package.json'), 'utf-8')) as { name: string }
    ).name?.startsWith('@')
      ? ['--access', 'public']
      : [];
    // Use spawn for interactive npm publish (required for 2FA/OTP prompts)
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(
      'npm',
      ['publish', './dist', '--tag', distTag, `--registry=${NPM_REGISTRY}`, ...accessFlag],
      {
        cwd: process.cwd(),
        stdio: 'inherit'
      }
    );
    if (result.status !== 0) {
      throw new Error(`npm publish exited with code ${result.status}`);
    }
  } catch (error) {
    console.error(`❌ npm publish failed.`);
    // Ensure rollback is not marked as done so that tag/commit cleanup happens.
    releaseDone = false;
    throw error;
  }
  console.log(`✅ Published ${tag} to npm.`);
  releaseDone = true;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

try {
  await main();
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  // ProcessOutput errors from zx already printed the command output; only
  // print extra context for our own thrown errors.
  if (!(error instanceof ProcessOutput)) {
    console.error(`❌ ${msg}`);
  }
  await rollback();
  if (typeof error === 'object' && error !== null && 'exitCode' in error) {
    const exitCode = (error as Record<string, unknown>).exitCode;
    process.exit(typeof exitCode === 'number' || typeof exitCode === 'string' ? exitCode : 1);
  } else {
    process.exit(1);
  }
}
