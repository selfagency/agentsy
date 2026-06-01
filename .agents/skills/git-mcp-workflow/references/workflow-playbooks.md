# MCP-First Workflow Playbooks

These playbooks adapt common Git workflows to `git-mcp`.

> **Do not use `git` via the shell for any operation covered here.** Shell-invoked `git` requires precise quoting across `sh`/`bash`/`zsh` layers. LLMs routinely produce malformed quoting that silently truncates commit messages, misinterprets arguments as flags, and breaks paths with spaces. Every workflow below uses `git-mcp` tools exclusively, which pass arguments as typed arrays with no shell interpretation.

---

## 1. Simple feature branch flow

Use for standard GitHub Flow work.

1. Orient:
   - `git_context action=summary`
   - `git_status action=status`
   - `git_history action=lg` — graph view of branch topology
2. Sync your base:
   - `git_remotes action=fetch`
   - `git_branches action=checkout ref=main`
   - `git_remotes action=pull`
3. Create the branch:
   - `git_branches action=create name=feat/my-feature from_ref=main create=true`
4. Inspect edits as you work:
   - `git_status action=diff mode=unstaged` — changes not yet staged
   - `git_status action=diff mode=staged` — after staging
5. Stage and commit:
   - `git_commits action=add all=true` (or `paths=[...]` for specific files)
   - `git_commits action=commit message="feat: describe the change"`
6. Publish:
   - `git_remotes action=push set_upstream=true`

Guidance:

- Keep commits atomic and reviewable
- Use Conventional Commit messages
- Quick context save: `git_commits action=wip` stages and commits "WIP" in one call
- Undo the last unpublished commit without losing changes: `git_commits action=undo`

---

## 2. Review-fix cleanup flow

Use when a PR gets feedback and the branch needs cleanup.

1. Inspect branch state:
   - `git_context action=summary`
   - `git_status action=status`
   - `git_history action=log`
2. Apply fixes and commit them normally
3. If the branch is still private and the user wants a cleaned-up history:
   - `git_remotes action=fetch`
   - `git_workspace action=rebase rebase_action=start rebase_upstream=origin/main`
4. Resolve conflicts, then:
   - `git_commits action=add all=true`
   - `git_workspace action=rebase rebase_action=continue`
5. Publish rewritten history safely:
   - `git_remotes action=push force_with_lease=true`

Do not use this on shared/public branches unless the user clearly approves history rewriting.

---

## 3. Safe recovery after reset, rebase, or detached HEAD

### Bad reset or rebase

1. Capture recovery state:
   - `git_history action=reflog` — find the lost HEAD position
   - `git_history action=log`
2. Identify the target SHA
3. Recover with one of:
   - `git_commits action=reset mode=soft target=<SHA>` — soft reset to lost commit
   - `git_workspace action=cherry_pick cherry_pick_action=start cherry_pick_refs=[<SHA>]` — replay onto current branch
4. Verify:
   - `git_status action=status`
   - `git_history action=log`

Prefer `cherry_pick` when you want a conservative recovery that does not move the branch pointer backward.

### Detached HEAD

1. Confirm state: `git_context action=summary`, `git_history action=log`
2. If work should be preserved, create a branch from the current SHA:
   - `git_branches action=create name=recovery/<short-sha> from_ref=HEAD create=true`
3. Continue normal work from the new branch

---

## 4. Backport or selective fix flow

Use for hotfixes and maintenance branches.

1. Find the source commit:
   - `git_history action=show ref=<SHA>` — inspect patch
   - `git_history action=log` — find the right SHA
2. Switch to the target branch:
   - `git_branches action=checkout ref=<maintenance-branch>`
3. Apply the fix:
   - `git_workspace action=cherry_pick cherry_pick_action=start cherry_pick_refs=[<SHA>]`
4. If conflicts occur:
   - `git_status action=status` — inspect
   - resolve files in worktree
   - `git_commits action=add all=true`
   - `git_workspace action=cherry_pick cherry_pick_action=continue`
5. Validate and push:
   - `git_history action=log`
   - `git_remotes action=push`

---

## 5. Worktree isolation flow

### Directory strategy

Prefer this order when choosing a worktree location:

1. existing `.worktrees/`
2. existing `worktrees/`
3. a documented project preference
4. ask the user

### Safety checks

Before creating a project-local worktree:

- Inspect whether the directory already exists with workspace file tools
- Inspect `.gitignore` to confirm the directory is ignored
- If it is not ignored, fix that first

### Creation flow

1. Orient: `git_context action=summary`
2. Choose location and branch name
3. Create the worktree:
   - `git_workspace action=worktree worktree_action=add path=<dir> branch=<branch>`
   - For a detached worktree: add `worktree_detached=true`
4. Run project setup and baseline validation
5. Report the worktree path and baseline status

### Cleanup

- Remove: `git_workspace action=worktree worktree_action=remove path=<dir>`
- Lock while temporarily unused: `git_workspace action=worktree worktree_action=lock path=<dir> worktree_lock_reason="in-progress"`
- Prune stale entries: `git_workspace action=worktree worktree_action=prune`
- View all: `git_workspace action=worktree worktree_action=list`

Red flags:

- Never create a project-local worktree without checking ignore rules
- Never assume a directory convention when the repo already documents one
- Never start implementation from a worktree whose baseline is already failing without telling the user

---

## 6. Stash-driven context switch flow

Use when work is not ready to commit.

1. Inspect what would be stashed:
   - `git_status action=status`
   - `git_status action=diff mode=unstaged`
2. Stash everything including untracked (convenience shortcut):
   - `git_workspace action=stash_all message="<description>"`
   - Or granularly: `git_workspace action=stash stash_action=save message="<description>" include_untracked=true`
3. Switch branches or pull changes
4. Restore later:
   - `git_workspace action=stash stash_action=list` — find the right stash index
   - `git_workspace action=stash stash_action=pop index=0` — pop and remove
   - Or `stash_action=apply` to keep the stash entry
5. Validate: `git_status action=status`, `git_status action=diff mode=unstaged`

---

## 7. Regression hunt with bisect

Use when you know a good state and a bad state.

1. Orient: `git_context action=summary`, `git_history action=log`
2. Begin bisect with known bounds:
   - `git_workspace action=bisect bisect_action=start good_ref=<known-good-SHA> bad_ref=HEAD`
3. At each step, test the checked-out revision
4. Mark each step:
   - `git_workspace action=bisect bisect_action=good` or `bisect_action=bad`
   - Or skip a flaky commit: `bisect_action=skip ref=<SHA>`
5. When bisect identifies the culprit:
   - `git_history action=show ref=<culprit-SHA>` — record the commit
6. End the session:
   - `git_workspace action=bisect bisect_action=reset`

For automated test-driven bisect:

- `git_workspace action=bisect bisect_action=run command="pnpm test --silent"`
- The command must exit 0 for good, non-0 for bad

---

## 8. Release tagging and GitHub release flow

### Tagging with git-mcp

1. Confirm release readiness:
   - `git_context action=summary`
   - `git_status action=status`
   - `git_history action=log`
2. Verify version files via workspace file reads or project tests
3. Create the annotated tag:
   - `git_workspace action=tag tag_action=create name=v1.2.3 target=HEAD message="Release v1.2.3"`
   - For signed tags: add `sign=true` and optionally `signing_key=<keyid>`
4. View all tags: `git_workspace action=tag tag_action=list`
5. Push the tag:
   - `git_remotes action=push tags=true`

### GitHub release guidance

GitHub Releases are outside `git-mcp`. Use GitHub tooling for release objects.

Rules:

- Never delete a published GitHub release to retry it; fix forward with the next version
- For maintenance-branch releases, ensure the GitHub release is not marked as latest unless intended
- Create releases only after the correct commit and version files are verified

---

## 9. Branching strategy workflows

### GitHub Flow

Prefer for continuous delivery and short-lived branches.

```text
git_remotes action=fetch
git_branches action=checkout ref=main
git_remotes action=pull
git_branches action=create name=feat/... from_ref=main create=true
# work...
git_commits action=add all=true
git_commits action=commit message="feat: ..."
git_remotes action=push set_upstream=true
# PR via GitHub tooling
```

### Git Flow (classic)

Prefer for scheduled releases and release branches.

```text
# Initialize
git_flow action=init

# Inspect current flow state first
git_flow action=overview

# Feature
git_flow operation=topic topic_action=start topic=feature name=my-feature
git_flow operation=topic topic_action=finish topic=feature name=my-feature

# Release
git_flow operation=topic topic_action=start topic=release name=1.2.0
git_flow operation=topic topic_action=finish topic=release name=1.2.0

# Hotfix
git_flow operation=topic topic_action=start topic=hotfix name=1.1.1
git_flow operation=topic topic_action=finish topic=hotfix name=1.1.1
```

### git-flow-next preset workflows

Use when the repository uses configured branch graphs instead of only the classic hardcoded branch families.

```text
# Initialize with preset
git_flow operation=init preset=github  # or classic, gitlab

# Inspect configured flow first
git_flow operation=overview

# Manage topic type config
git_flow operation=config config_action=add topic=chore prefix=chore/
git_flow operation=config config_action=list

# Start and finish a configured topic branch
git_flow operation=topic topic_action=start topic=chore name=update-deps
git_flow operation=topic topic_action=publish topic=chore name=update-deps
git_flow operation=topic topic_action=finish topic=chore name=update-deps

# List active branches for a topic type
git_flow operation=topic topic_action=list topic=feature
```

### git_flow finish recovery

Use when a finish sequence pauses on merge conflicts.

1. `git_flow operation=topic topic_action=finish topic=feature name=<name>`
2. Resolve conflicts in the working tree
3. `git_commits action=add all=true`
4. `git_flow operation=control control_action=continue` — resume the paused finish
5. Or: `git_flow operation=control control_action=abort` — unwind the in-progress finish

### Hook-aware flow execution

Hook/filter execution is disabled by default. To enable:

- Set `GIT_ALLOW_FLOW_HOOKS=true` in the server environment only when repo hooks are trusted
- Run `git_flow operation=overview` before any mutating flow action
- When hooks are disabled, responses report skipped execution instead of running repository programs

### Trunk-based development

Keep branches extremely short-lived. Use the same MCP calls as GitHub Flow but merge within hours, not days.

---

## 10. Merge workflow

Use when merging a branch without rebasing.

1. Orient: `git_context action=summary`
2. Ensure local branch is up to date:
   - `git_remotes action=fetch`
   - `git_branches action=checkout ref=<target-branch>`
   - `git_remotes action=pull`
3. Merge the source branch:
   - `git_workspace action=merge merge_action=start merge_refs=[<source-branch>]`
   - No-fast-forward for explicit merge commits: add `merge_no_ff=true`
   - Squash merge: add `merge_squash=true`
4. If conflicts occur:
   - `git_status action=status` — identify conflicted files
   - Resolve files in worktree
   - `git_commits action=add all=true`
   - `git_workspace action=merge merge_action=continue`
5. Validate: `git_history action=log`
6. Push: `git_remotes action=push`

---

## 11. Hooks, CI, and commit discipline

- Do not bypass hooks by default
- If hooks fail, fix the underlying issue
- Use Conventional Commit messages
- Keep commits atomic
- Prefer small PRs with clear summaries and test notes

For this repository specifically:

- Pre-commit runs `pnpm exec lint-staged` and `pnpm typecheck`
- Before finishing work, run:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`

---

## 12. When CLI is absolutely necessary

Use the shell only when a required capability is not exposed by `git-mcp`:

- Interactive rebase editing with manual squash/reword/drop choreography (requires text editor)
- Patch-mode staging (`git add -p`)
- Repository-wide history rewriting (`git filter-repo`)
- Project-specific hook installation commands

Even then:

- Capture `git_history action=reflog` first
- Explain the risk to the user
- Prefer the least destructive option
