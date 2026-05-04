# Releasing Packages

Releases are per-package in this monorepo. Each package gets its own version tag and npm publishing. The workflow supports simultaneous releases of multiple packages.

## Single Package Release

```bash
# Release any package in the workspace
pnpm release @agentsy/vscode 0.1.5
pnpm release @agentsy/processor 0.2.0
```

## What Happens

1. **Validation**: Script checks prerequisites (git, npm auth, GitHub token)
2. **File Updates**:
   - Updates `packages/[package]/package.json` with new version
   - Appends release notes to `packages/[package]/CHANGELOG.md`
3. **Git Operations**:
   - Creates commit: `chore(release): @agentsy/[package]@version`
   - Pushes to origin/main
4. **Workflow Execution**:
   - Waits for "Test & Build" workflow to pass on the commit
5. **Tagging**:
   - Creates annotated tag: `@agentsy/<package>@<version>`
   - Pushes tag to origin (triggers Release workflow)
6. **Publishing**:
   - Builds the package: `pnpm -F @agentsy/<package> build`
   - Runs `node scripts/write-dist-package.js` for that package
   - Publishes to npm with `--access public`
   - Creates GitHub Release with release notes

## Prerequisites

- **Git**: Repository clean, on main branch, pushed to origin
- **npm**: Authenticated (`npm login` or `NPM_TOKEN` env var)
- **GitHub**: Token via `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth token`

## Tag Format

- **Root**: `v1.2.3` (single monorepo version)
- **Per-package**: `@agentsy/<package>@<version>` (for example `@agentsy/vscode@0.1.5`)

The tag format tells the release workflow which package to publish.

## Concurrent Releases

You can release multiple packages without waiting:

```bash
pnpm release @agentsy/vscode 0.1.5 &
pnpm release @agentsy/processor 0.2.0 &
wait
```

Each creates its own tag and release independently. They share the same "Test & Build" workflow run if pushed in quick succession.

## Rollback

If the release fails before npm publish:

- **Before push**: Local commit is reset
- **After push, before tag**: Commit is reverted on origin/main
- **After tag**: Tag is deleted from remote and local

## Troubleshooting

### "npm whoami" fails

Ensure npm auth token is set:

```bash
npm login
# OR
export NPM_TOKEN="npm_xxxx..."
```

### "No GitHub token found"

```bash
gh auth login
# OR
export GH_TOKEN="ghp_xxx..."
```

### "Tag already exists"

Delete the local tag:

```bash
git tag -d @agentsy/vscode@0.1.5
```

## Configuration Files

- **scripts/release-per-package.js**: Main orchestrator (per-package aware)
- **.github/workflows/release.yml**: GitHub Actions (detects tag format, publishes)
- **scripts/write-dist-package.js**: Builds dist/package.json for publishing
- **packages/[package]/CHANGELOG.md**: Release notes per-package
