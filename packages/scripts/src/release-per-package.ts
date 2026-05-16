#!/usr/bin/env zx
/**
 * Per-package release orchestrator for monorepo.
 *
 * Usage: pnpm release <package-name> <version> [--dry-run]
 *
 * Examples:
 *   pnpm release @agentsy/vscode 0.2.0
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
process.env.HUSKY = "0";

import { spawnSync } from "node:child_process";
import type { SpawnSyncOptions, SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Octokit } from "@octokit/rest";
import ora from "ora";
import { $, argv, cd, sleep } from "zx";

import { getPackageReleaseState, readReleaseState } from "./release-state.ts";
import {
  getRepositoryField,
  validateRepositoryMatch,
} from "./trusted-publish-readiness.js";

$.verbose = false;

type ReleaseNotesOptions = Parameters<
  Octokit["repos"]["generateReleaseNotes"]
>[0] & {
  previous_tag_name?: string;
};

type GitHubWorkflow = Awaited<
  ReturnType<Octokit["actions"]["listRepoWorkflows"]>
>["data"]["workflows"][number];
type GitHubWorkflowRun = Awaited<
  ReturnType<Octokit["actions"]["listWorkflowRuns"]>
>["data"]["workflow_runs"][number];
type WorkflowSpinner = ReturnType<typeof ora>;
interface WaitForWorkflowOptions {
  timeoutMs?: number;
  pollMs?: number;
  branch?: string | undefined;
}
interface WaitForLatestWorkflowOptions {
  timeoutMs?: number;
  pollMs?: number;
  branch?: string;
}

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const ROOT = resolve(__dirname, "..");
const RELEASE_STATE_PATH = resolve(ROOT, "config", "release-state.json");
cd(ROOT);

// Defensive filesystem helpers
function isPathInsideRoot(p: string): boolean {
  try {
    const resolved = resolve(p);
    const rel = relative(ROOT, resolved);
    return rel === "" || (!rel.startsWith("..") && !rel.startsWith("../"));
  } catch {
    return false;
  }
}

function safeRead(p: string, enc: BufferEncoding = "utf-8"): string {
  if (!isPathInsideRoot(p)) {
    throw new Error(`Refusing to read outside repository root: ${p}`);
  }
  return readFileSync(resolve(p), enc);
}

function safeWrite(p: string, data: string): void {
  if (!isPathInsideRoot(p)) {
    throw new Error(`Refusing to write outside repository root: ${p}`);
  }
  return writeFileSync(resolve(p), data);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseVersionArg(versionArg: string | undefined): string {
  if (!versionArg || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(versionArg)) {
    console.error(
      `❌ Invalid version: "${versionArg}". Expected semver (e.g. 1.2.3 or 1.2.3-beta.1)`
    );
    process.exit(1);
  }

  return versionArg;
}

const packageName = argv._[0];
const version = parseVersionArg(
  typeof argv._[1] === "string" ? argv._[1] : undefined
);
const isDryRun = Boolean(argv["dry-run"] || argv.dryRun);
const isRetag = Boolean(argv.retag || argv["re-tag"]);

if (!packageName) {
  console.error("Usage: pnpm release <package-name> <version> [--dry-run]");
  console.error("");
  console.error("Examples:");
  console.error("  pnpm release @agentsy/vscode 0.2.0");
  console.error("  pnpm release @agentsy/vscode 0.1.5 --dry-run");
  process.exit(1);
}

// Resolve package directory
const PACKAGES_DIR = resolve(ROOT, "packages");

// Normalize short names (e.g., "vscode" -> "@agentsy/vscode")
const normalizedPackageName = packageName.includes("/")
  ? packageName
  : `@agentsy/${packageName}`;

const pkgShortName = normalizedPackageName.replace(/^@[^/]+\//, "");
const pkgDir = resolve(PACKAGES_DIR, pkgShortName);
const pkgJsonPath = resolve(pkgDir, "package.json");

if (!existsSync(pkgDir)) {
  console.error(`❌ Package directory not found: ${pkgDir}`);
  console.error(
    `   Available packages include: @agentsy/vscode and other @agentsy/* workspace packages`
  );
  process.exit(1);
}

if (!existsSync(pkgJsonPath)) {
  console.error(`❌ package.json not found at: ${pkgJsonPath}`);
  process.exit(1);
}

// Load actual package name from package.json (needed for tag construction below)
const pkgJson = JSON.parse(safeRead(pkgJsonPath, "utf-8"));
const fullPackageName = pkgJson.name;

const releaseState = readReleaseState(RELEASE_STATE_PATH);
const packageReleaseState = getPackageReleaseState(
  releaseState,
  fullPackageName
);

if (packageReleaseState !== "oidc-ready") {
  console.error(
    `❌ ${fullPackageName} is '${packageReleaseState}', not 'oidc-ready'.`
  );
  console.error(
    "   This package must be bootstrap-published locally once before CI OIDC publishing is allowed."
  );
  console.error(
    `   Run: pnpm bootstrap-release ${fullPackageName} ${version} --yes-i-know-this-is-first-publish`
  );
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
let gitCmd = "git";
const SAFE_PATH = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");

function withSafePathEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: SAFE_PATH };
}

function runGit(
  args: readonly string[],
  options: SpawnSyncOptions = {}
): SpawnSyncReturns<string> {
  const result = spawnSync(gitCmd, args, {
    cwd: ROOT,
    encoding: "utf-8",
    shell: false,
    ...options,
  }) as SpawnSyncReturns<string>;

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const details =
      stderr ||
      stdout ||
      `git ${args.join(" ")} failed with exit code ${result.status}`;
    throw new Error(details);
  }

  return result;
}

function resolveGitExecutable() {
  const direct = spawnSync("git", ["--version"], {
    env: withSafePathEnv(),
    shell: false,
    stdio: "ignore",
  });
  if (direct.status === 0) {
    return "git";
  }

  const locatorCommand = process.platform === "win32" ? "where" : "which";
  const located = spawnSync(locatorCommand, ["git"], {
    encoding: "utf-8",
    env: withSafePathEnv(),
    shell: false,
  });
  if (located.status === 0) {
    const candidate = located.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function rollback() {
  if (releaseDone) {
    return;
  }

  $.verbose = false;
  try {
    if (tagPushed) {
      console.log(`\n⚠️  Release interrupted. Deleting remote tag ${tag}...`);
      try {
        runGit(["push", "origin", "--delete", tag]);
        runGit(["tag", "-d", tag]);
        console.log(`↩️  Tag ${tag} deleted.`);
      } catch {
        console.error(`⚠️  Could not delete tag ${tag}. Manually run:`);
        console.error(
          `   git push origin --delete '${tag}' && git tag -d '${tag}'`
        );
      }
    }

    if (commitPushed) {
      console.log("\n⚠️  Reverting release commit on origin/main...");
      try {
        runGit(["revert", "--no-edit", "HEAD"]);
        runGit(["push", "origin", "main"]);
        console.log("↩️  Commit reverted and pushed.");
      } catch {
        console.error("❌ Auto-revert failed. Manually run:");
        console.error("   git revert HEAD && git push origin main");
      }
    } else if (commitLocal) {
      console.log("\n⚠️  Resetting local release commit...");
      try {
        runGit(["reset", "--hard", "HEAD~1"]);
        console.log("↩️  Commit removed.");
      } catch {
        console.error("❌ Reset failed. Manually run: git reset --hard HEAD~1");
      }
    }
  } catch {
    /* best effort */
  }
}

process.on("SIGINT", async () => {
  await rollback();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await rollback();
  process.exit(143);
});

// ---------------------------------------------------------------------------
// Prerequisite helpers
// ---------------------------------------------------------------------------

async function checkNpmCredentials(npmRegistry: string): Promise<void> {
  try {
    const registry = String(npmRegistry).trim();
    await $`npm whoami --registry=${registry}`;
  } catch {
    console.error(`❌ Not logged in to npm (registry: ${npmRegistry}).`);
    console.error("   Tips:");
    console.error("   - Run: npm login --registry=https://registry.npmjs.org/");
    console.error('   - Or: export NPM_TOKEN="npm_xxx..."');
    process.exit(1);
  }
}

async function resolveGithubToken() {
  let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (!token) {
    try {
      token = (await $`gh auth token`).stdout.trim();
    } catch {
      console.error(
        "❌ No GitHub token found. Set GH_TOKEN/GITHUB_TOKEN or run: gh auth login"
      );
      process.exit(1);
    }
  }
  return token;
}

function updateChangelogFile(
  changelogPath: string,
  heading: string,
  releaseNotes: string,
  previousTag: string,
  tag: string
): void {
  let original;
  try {
    original = safeRead(changelogPath, "utf-8");
  } catch {
    original = "# Changelog\n\n## [Unreleased]\n";
  }

  if (original.includes(heading)) {
    console.log(
      "ℹ️  CHANGELOG already contains this release heading; skipping."
    );
    return;
  }

  const sourceLine = previousTag
    ? `\n\n_Source: changes from ${previousTag} to ${tag}._`
    : "";
  const section = `\n${heading}\n\n${releaseNotes}${sourceLine}\n`;
  const marker = "## [Unreleased]";
  const idx = original.indexOf(marker);
  const updated =
    idx !== -1
      ? `${original.slice(0, idx + marker.length)}\n${section}${original.slice(idx + marker.length)}`
      : `${original}\n${section}`;
  safeWrite(changelogPath, updated);
}

function ensureCleanMainBranch(): void {
  const dirty = runGit(["status", "--porcelain"]).stdout.trim();
  if (dirty) {
    console.error(
      "❌ Working tree is not clean. Commit or stash changes first."
    );
    process.exit(1);
  }

  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branch !== "main") {
    console.error(`❌ Must run from 'main'. Current branch: ${branch}`);
    process.exit(1);
  }
}

function syncMainBranch(): void {
  console.log("🔄 Fetching latest refs...");
  runGit(["fetch", "origin", "main"]);
  runGit(["pull", "--ff-only", "origin", "main"]);
}

function parseOwnerRepoFromRemoteUrl(remoteUrl: string): {
  owner: string;
  repo: string;
} {
  const normalized = remoteUrl.trim().replace(/\.git$/, "");

  if (normalized.startsWith("git@")) {
    const colonIndex = normalized.indexOf(":");
    if (colonIndex === -1) {
      return { owner: "", repo: "" };
    }

    const path = normalized.slice(colonIndex + 1);
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) {
      return { owner: "", repo: "" };
    }

    return {
      owner: path.slice(0, slashIndex),
      repo: path.slice(slashIndex + 1),
    };
  }

  try {
    const parsed = new URL(normalized);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return { owner: "", repo: "" };
    }

    return {
      owner: parts[0] ?? "",
      repo: parts[1] ?? "",
    };
  } catch {
    return { owner: "", repo: "" };
  }
}

function resolveOwnerRepoFromOrigin(): { owner: string; repo: string } {
  const remoteUrl = runGit(["remote", "get-url", "origin"]).stdout.trim();
  const { owner, repo } = parseOwnerRepoFromRemoteUrl(remoteUrl);
  if (!owner || !repo) {
    console.error(`❌ Cannot parse owner/repo from remote URL: ${remoteUrl}`);
    process.exit(1);
  }

  return { owner, repo };
}

function ensureLocalTagAvailability(): void {
  const localTag = runGit(["tag", "-l", tag]).stdout.trim();
  if (!localTag) {
    return;
  }

  if (isRetag) {
    console.log(`⚠️  Local tag '${tag}' exists — deleting for retag...`);
    runGit(["tag", "-d", tag]);
    return;
  }

  console.error(
    `❌ Local tag '${tag}' already exists. Run: git tag -d '${tag}'`
  );
  process.exit(1);
}

async function ensureRemoteTagAvailability(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<void> {
  try {
    await octokit.git.getRef({ owner, ref: `tags/${tag}`, repo });
    if (!isRetag) {
      console.error(`❌ Remote tag '${tag}' already exists.`);
      console.error(
        `   If the previous CI run failed and you want to retag, rerun with --retag.`
      );
      process.exit(1);
    }

    console.log(`⚠️  Remote tag '${tag}' exists — deleting for retag...`);
    await octokit.git.deleteRef({ owner, ref: `tags/${tag}`, repo });
    console.log(`↩️  Remote tag deleted.`);
    const localTagExists = runGit(["tag", "-l", tag]).stdout.trim();
    if (localTagExists) {
      runGit(["tag", "-d", tag]);
    }
  } catch (error: unknown) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("status" in error) ||
      (error as { status?: unknown }).status !== 404
    ) {
      throw error;
    }
  }
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

  process.env.NPM_CONFIG_USERCONFIG ||= resolve(homedir(), ".npmrc");
  const NPM_REGISTRY =
    process.env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org/";

  await checkNpmCredentials(NPM_REGISTRY);

  const githubToken = await resolveGithubToken();
  const octokit = new Octokit({ auth: githubToken });

  // --- Precondition checks -------------------------------------------------
  ensureCleanMainBranch();
  syncMainBranch();

  // Re-read pkgJson and release state now that main is up to date.
  const latestPkgJson = JSON.parse(safeRead(pkgJsonPath, "utf-8"));
  const latestReleaseState = readReleaseState(RELEASE_STATE_PATH);
  const packageReleaseState = getPackageReleaseState(
    latestReleaseState,
    fullPackageName
  );

  if (packageReleaseState !== "oidc-ready") {
    console.error(
      `❌ ${fullPackageName} is '${packageReleaseState}', not 'oidc-ready'.`
    );
    console.error(
      "   This package must be bootstrap-published locally once before CI OIDC publishing is allowed."
    );
    console.error(
      `   Run: pnpm bootstrap-release ${fullPackageName} ${version} --yes-i-know-this-is-first-publish`
    );
    process.exit(1);
  }

  // Derive owner/repo from git remote
  const { owner, repo } = resolveOwnerRepoFromOrigin();

  const expectedRepo = `${owner}/${repo}`;
  const packageRepository = getRepositoryField(latestPkgJson.repository);
  if (!packageRepository) {
    console.error(
      `❌ Package ${latestPkgJson.name} is missing package.json repository metadata. Add repository.url before releasing or marking this package oidc-ready.`
    );
    process.exit(1);
  }

  const repoCheck = validateRepositoryMatch(packageRepository, expectedRepo);
  if (!repoCheck.ok) {
    console.error(`❌ ${repoCheck.error}`);
    process.exit(1);
  }

  ensureLocalTagAvailability();
  await ensureRemoteTagAvailability(octokit, owner, repo);

  // --- Previous tag for release notes diff ---------------------------------

  const tagsResp = await octokit.paginate(octokit.git.listMatchingRefs, {
    owner,
    per_page: 100,
    ref: "tags/",
    repo,
  });

  // Filter tags for this package, sort by semver
  const parseVer = (v: string): number[] => {
    const version = v.slice(v.lastIndexOf("@") + 1);
    return version.split(".").map(Number);
  };

  const previousTag =
    tagsResp
      .map((r) => r.ref.replace("refs/tags/", ""))
      .filter((t) => t.startsWith(`${fullPackageName}@`) && t !== tag)
      .toSorted((a, b) => {
        const [aMaj = 0, aMin = 0, aPatch = 0] = parseVer(a);
        const [bMaj = 0, bMin = 0, bPatch = 0] = parseVer(b);
        return aMaj - bMaj || aMin - bMin || aPatch - bPatch;
      })
      .at(-1) ?? "";

  // --- Release notes -------------------------------------------------------

  console.log(`📝 Generating release notes for ${tag}...`);

  const releaseNotesOpts: ReleaseNotesOptions = {
    owner,
    repo,
    tag_name: tag,
    target_commitish: "main",
  };
  if (previousTag) {
    releaseNotesOpts.previous_tag_name = previousTag;
  }

  const notesResp = await octokit.repos.generateReleaseNotes(releaseNotesOpts);
  const releaseNotes = notesResp.data.body?.trim() || "- No notable changes.";

  // --- Update package.json -------------------------------------------------

  console.log(`🧩 Updating ${fullPackageName} to ${version}...`);
  const pkg = JSON.parse(safeRead(pkgJsonPath, "utf-8"));
  pkg.version = version;
  safeWrite(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // --- Update CHANGELOG.md -------------------------------------------------

  console.log("🧩 Updating CHANGELOG.md...");
  const changelogPath = resolve(pkgDir, "CHANGELOG.md");
  const date = new Date().toISOString().slice(0, 10);
  const heading = `## [${version}] - ${date}`;
  updateChangelogFile(changelogPath, heading, releaseNotes, previousTag, tag);

  // --- Commit + push -------------------------------------------------------

  const hasChanges = runGit([
    "diff",
    "--name-only",
    "--",
    resolve(pkgDir, "package.json"),
    resolve(pkgDir, "CHANGELOG.md"),
  ]).stdout.trim();

  if (hasChanges) {
    console.log("📦 Committing release metadata...");
    runGit([
      "add",
      resolve(pkgDir, "package.json"),
      resolve(pkgDir, "CHANGELOG.md"),
    ]);
    runGit(["commit", "-m", `chore(release): ${tag}`]);
    commitLocal = true;
  } else {
    console.log("ℹ️  No version/changelog changes; nothing to commit.");
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

  console.log("🚀 Pushing main...");
  runGit(["push", "origin", "main"]);
  commitPushed = true;
  commitLocal = false;

  // Capture pushed commit SHA
  const headSha = runGit(["rev-parse", "HEAD"]).stdout.trim();
  const parentSha = runGit(["rev-parse", `${headSha}^`]).stdout.trim();

  const changedFiles = runGit([
    "show",
    "--name-only",
    "--pretty=format:",
    headSha,
  ])
    .stdout.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metadataOnlyFiles = new Set([
    `packages/${pkgShortName}/package.json`,
    `packages/${pkgShortName}/CHANGELOG.md`,
  ]);

  const isMetadataOnlyReleaseCommit =
    changedFiles.length > 0 &&
    changedFiles.every((file) => metadataOnlyFiles.has(file));

  // --- Wait for required workflows -----------------------------------------

  if (isMetadataOnlyReleaseCommit) {
    console.log(
      `⚡ Metadata-only release commit detected; validating Test & Build on parent commit ${parentSha.slice(0, 7)} instead of ${headSha.slice(0, 7)}.`
    );
    const spinner = ora(
      "Test & Build: checking latest successful run on main"
    ).start();
    await waitForLatestSuccessfulWorkflow(
      octokit,
      "Test & Build",
      owner,
      repo,
      spinner
    );
    spinner.succeed("Test & Build: latest successful run on main found");
  } else {
    const shaToValidate = headSha;
    console.log(`🔎 Waiting for workflows on ${shaToValidate.slice(0, 7)}...`);
    await sleep(10_000);

    const spinner = ora("Test & Build: queued").start();
    await waitForWorkflow(
      octokit,
      "Test & Build",
      owner,
      repo,
      shaToValidate,
      spinner
    );
  }

  // --- Tag + push ----------------------------------------------------------

  console.log(`🏷️  Creating annotated tag '${tag}'...`);
  const tagMessage = [
    `Release ${tag}`,
    releaseNotes,
    previousTag ? `Source: changes from ${previousTag} to ${tag}.` : "",
    `Target commit: ${headSha}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  runGit(["tag", "-a", tag, headSha, "-m", tagMessage]);

  console.log(`🚀 Pushing tag '${tag}'...`);
  runGit(["push", "origin", tag]);
  tagPushed = true;

  // --- Monitor Release workflow --------------------------------------------

  const releaseSpinner = ora(
    "Release: waiting for workflow to trigger..."
  ).start();
  await waitForWorkflow(
    octokit,
    "Release",
    owner,
    repo,
    headSha,
    releaseSpinner,
    {}
  );

  console.log(`✅ Release workflow complete: ${tag}`);
  releaseDone = true;
}

// ---------------------------------------------------------------------------
// Workflow polling
// ---------------------------------------------------------------------------

async function waitForWorkflow(
  octokit: Octokit,
  name: string,
  owner: string,
  repo: string,
  headSha: string,
  spinner: WorkflowSpinner,
  {
    timeoutMs = 3_600_000,
    pollMs = 15_000,
    branch,
  }: WaitForWorkflowOptions = {}
) {
  const workflowsResp = await octokit.actions.listRepoWorkflows({
    owner,
    per_page: 100,
    repo,
  });
  const workflow = workflowsResp.data.workflows.find(
    (w: GitHubWorkflow) => w.name === name
  );
  if (!workflow) {
    spinner.fail(`${name}: workflow not found`);
    throw new Error(`[${name}] workflow not found in ${owner}/${repo}`);
  }

  const deadline = Date.now() + timeoutMs;
  const cancelledRunIds = new Set<number>();

  while (Date.now() < deadline) {
    const runsResp = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflow.id,
      ...(branch ? { branch } : {}),
      head_sha: headSha,
      per_page: 10,
    });

    const run = runsResp.data.workflow_runs.find(
      (r: GitHubWorkflowRun) => !cancelledRunIds.has(r.id)
    );

    if (!run) {
      spinner.text = `${name}: waiting for workflow run...`;
    } else if (run.status !== "completed") {
      const elapsed = Math.round(
        (Date.now() - new Date(run.created_at).getTime()) / 1000
      );
      spinner.text = `${name}: ${run.status} (${elapsed}s)`;
    } else if (run.conclusion === "success") {
      spinner.succeed(`${name}: passed`);
      return;
    } else if (run.conclusion === "cancelled") {
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

async function waitForLatestSuccessfulWorkflow(
  octokit: Octokit,
  name: string,
  owner: string,
  repo: string,
  spinner: WorkflowSpinner,
  {
    timeoutMs = 600_000,
    pollMs = 10_000,
    branch = "main",
  }: WaitForLatestWorkflowOptions = {}
) {
  const workflowsResp = await octokit.actions.listRepoWorkflows({
    owner,
    per_page: 100,
    repo,
  });
  const workflow = workflowsResp.data.workflows.find(
    (w: GitHubWorkflow) => w.name === name
  );
  if (!workflow) {
    spinner.fail(`${name}: workflow not found`);
    throw new Error(`[${name}] workflow not found in ${owner}/${repo}`);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runsResp = await octokit.actions.listWorkflowRuns({
      branch,
      owner,
      per_page: 20,
      repo,
      status: "completed",
      workflow_id: workflow.id,
    });

    const successRun = runsResp.data.workflow_runs.find(
      (r: GitHubWorkflowRun) => r.conclusion === "success"
    );
    if (successRun) {
      spinner.text = `${name}: latest success on ${successRun.head_sha.slice(0, 7)}`;
      return;
    }

    spinner.text = `${name}: waiting for a successful completed run on ${branch}...`;
    await sleep(pollMs);
  }

  spinner.fail(`${name}: no successful completed run found`);
  throw new Error(
    `Timed out waiting for a successful '${name}' workflow run on ${branch}.`
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

try {
  await main();
} catch (error) {
  process.stdout.write("\n");
  console.error(error instanceof Error ? error.message : error);
  await rollback();
  process.exit(1);
}
