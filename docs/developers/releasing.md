# Releasing Packages

Releases are per-package in this monorepo. Each package uses a two-lane model:

1. **Bootstrap publish (one-time, local)** for packages never published on npm before.
2. **Trusted publishing (ongoing, CI/OIDC)** after bootstrap and npm trusted publisher setup.

Releases remain merge-approved via `main` and triggered by package tags.

## Single Package Release

```bash
# Release any package in the workspace
pnpm release @agentsy/vscode 0.1.5
pnpm release @agentsy/processor 0.2.0
```

## First Publish (Bootstrap, one-time)

Use this only for packages that have never been published and are still marked `bootstrap-required` in `config/release-state.json`.

```bash
# Replace 'pkg-name' with the actual package short name (e.g. a newly added workspace package)
pnpm bootstrap-release @agentsy/pkg-name 0.1.0 --yes-i-know-this-is-first-publish
```

What bootstrap does:

- validates working tree is clean and on `main`
- updates package version
- builds package output
- writes `dist/package.json`
- publishes from local machine once
- marks package as `oidc-ready` in `config/release-state.json`

After bootstrap, configure trusted publisher on npmjs package settings:

- provider: GitHub Actions
- repository: `selfagency/agentsy` (exact match)
- workflow filename: `release.yml` (exact match)
- optional environment: only if you use GitHub environments

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
   - Publishes to npm with OIDC trusted publishing (no publish token)
   - Creates GitHub Release with release notes

## Prerequisites

- **Git**: Repository clean, on main branch, pushed to origin
- **npm CLI**: version `>= 11.5.1` (required for trusted publishing)
- **GitHub**: Token via `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth token`
- **Runner**: GitHub-hosted runners (self-hosted not currently supported by npm trusted publishing)

## Release State Gate

`config/release-state.json` controls whether a package may publish via CI:

- `bootstrap-required`: blocked in CI release workflow
- `oidc-ready`: allowed to publish via OIDC

CI release runs fail fast for packages that are not `oidc-ready`.

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

### "Release blocked: package is not oidc-ready"

Run one-time bootstrap publish first, then configure trusted publisher on npmjs.com:

```bash
pnpm bootstrap-release @agentsy/<package> <version> --yes-i-know-this-is-first-publish
```

### "Unable to authenticate" during CI publish

Check all trusted publisher fields on npmjs package settings are exact and case-sensitive:

- organization/user
- repository
- workflow filename (`release.yml`)

Also ensure package `repository.url` resolves to `selfagency/agentsy`.

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
- **scripts/bootstrap-release.js**: One-time first publish helper
- **.github/workflows/release.yml**: GitHub Actions (detects tag format, publishes)
- **scripts/write-dist-package.js**: Builds dist/package.json for publishing
- **config/release-state.json**: Package trusted-publishing readiness state
- **packages/[package]/CHANGELOG.md**: Release notes per-package
