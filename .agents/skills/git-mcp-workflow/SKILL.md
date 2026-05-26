---
name: git-mcp-workflow
description: Use this skill for repositories managed through the git-mcp server when the task involves Git inspection, staging or committing, branches, remotes, rebase, cherry-pick, stash, bisect, worktrees, Git Flow, LFS, release tagging, PR preparation, or recovery. Prefer git-mcp tools over shell git commands, including when the user asks in raw Git terms such as git_status, git_commit, git_push, git_rebase, git_reflog, git_flow, submodules, or “undo this safely”.
---

# Git MCP Workflow

An MCP-first workflow skill for repositories exposed through `git-mcp`.

Use it to translate everyday Git tasks and recovery tasks into the server's safe tool surface instead of ad-hoc shell commands.

## Core rule

- Always use `git-mcp` MCP tools for Git operations.
- Never invoke `git` via shell unless the operation truly is not covered by any `git-mcp` tool.
- Inspect repository state before mutating it.
- Prefer the most reversible safe operation that satisfies the user's intent.

If you need the rationale behind the shell restriction, read `references/shell-safety.md`.

## Core Operating Rules

### 1. Start with context, not vibes

For any non-trivial task, begin with:

1. `git_context action=summary`
2. `git_status action=status`
3. Targeted inspection: `git_history action=log`, `git_status action=diff`, `git_history action=show`, or `git_branches action=list`

`git_context action=summary` is the default entry point. It reports branch, upstream, pending changes, and in-progress operations (rebase, cherry-pick, merge, bisect).

### 2. Inspect before mutate

Prefer read-only calls first:

- `git_context action=summary` — repo state snapshot
- `git_status action=status` — working tree details
- `git_history action=log` — commit history
- `git_history action=show ref=<SHA>` — one commit inspection
- `git_status action=diff mode=unstaged` — unstaged changes
- `git_history action=blame file_path=<path>` — line attribution
- `git_history action=reflog` — recovery ledger
- `git_branches action=list` — local branches
- `git_remotes action=list` — configured remotes
- `git_context action=search query=<terms>` — history/code search
- `git_docs action=man query=<command>` — official docs

Only mutate after you understand:

- current branch and tracking state
- whether the tree is clean or dirty
- whether a merge, rebase, cherry-pick, or bisect is already in progress

### 3. Prefer the safest reversible operation

Safety order for undo and recovery:

1. `git_commits action=restore` for uncommitted file changes
2. `git_workspace action=stash_all` when switching context without losing work
3. `git_commits action=revert` for undoing published commits
4. `git_commits action=undo` for soft-resetting the last local commit
5. `git_commits action=reset mode=mixed` for local unpublished history
6. `git_commits action=reset mode=hard confirm=true` only with explicit user intent

Before any history-rewriting step, capture `git_history action=reflog` and `git_history action=log`.

### 4. Treat published history as radioactive

Rewriting history is allowed only when the user clearly wants it and the branch is safe to rewrite.

- Rebase only on unpublished or explicitly approved branches
- After rebasing, prefer `git_remotes action=push force_with_lease=true`
- Avoid unconditional force pushes unless the user explicitly requests them and `GIT_ALLOW_FORCE_PUSH=true` is set server-side
- Prefer `git_commits action=revert` over reset for shared branches

### 5. Respect hooks and CI

Do not bypass hooks casually.

- `no_verify` on `git_commits action=commit` and `git_remotes action=push` should stay `false` unless the user explicitly requests a bypass and `GIT_ALLOW_NO_VERIFY=true` is set server-side
- If hooks fail, fix the root cause
- In this repository specifically, `.husky/pre-commit` runs `pnpm exec lint-staged` and `pnpm typecheck`

### 6. Use adjacent tooling only where git-mcp stops

`git-mcp` covers repository operations, not every GitHub action.

- Use GitHub tooling for pull requests, review threads, approvals, and GitHub Releases
- Use workspace file tools for checking `.gitignore`, worktree directories, and project files
- **Never invoke `git` via the shell when a `git-mcp` tool exists for that operation.** The quoting hazards described above are not theoretical — they will corrupt commit messages, truncate arguments, and produce silent failures.

Narrow cases where CLI may still be necessary (confirm no MCP tool covers it first):

- interactive patch staging (`git add -p`)
- interactive rebase editing for squash/reword/reorder/drop flows
- `git filter-repo`-style deep history surgery
- repo-local hook installation commands

## Common tool families

- `git_context`, `git_status`, `git_history` for inspection
- `git_commits`, `git_branches`, `git_remotes` for everyday changes
- `git_workspace` for stash, rebase, cherry-pick, merge, bisect, tag, worktree, and submodule flows
- `git_flow` for git-flow-next-style lifecycle operations
- `git_lfs` for large-file workflows
- `git_docs` when the user needs authoritative Git usage help

See `references/tooling-map.md` for the full tool and action catalog.

## Recommended Workflow

### Everyday feature work

1. Orient with `git_context action=summary`
2. Inspect with `git_status action=status`, `git_status action=diff`, `git_history action=log`
3. Create or switch branches with `git_branches action=create` or `git_branches action=checkout`
4. Stage with `git_commits action=add`
5. Commit with `git_commits action=commit message="feat: ..."` using Conventional Commit messages
6. Sync with `git_remotes action=fetch`, `git_remotes action=pull`, `git_remotes action=push`
7. Prepare reviewable history with `git_workspace action=rebase` only if safe and explicitly appropriate

### Advanced work

- `git_workspace action=stash_all` — quick context switch without a commit
- `git_workspace action=rebase` — branch cleanup or rebasing onto upstream
- `git_workspace action=cherry_pick` — backports and targeted fixes
- `git_workspace action=bisect` — regression hunting
- `git_workspace action=worktree` — parallel branch work without stashing
- `git_workspace action=merge` — merge branches with full flag control
- `git_workspace action=tag` — release tags
- `git_workspace action=submodule` — embedded repositories
- `git_lfs` — large binary assets
- `git_flow` — scheduled release workflows, preset init, flow overview/config inspection, config CRUD, and finish recovery

## Validation checklist

Before you finish, confirm all of the following:

- Git operations used `git-mcp` tools, not shell `git`
- Repository context was inspected before any mutation
- The chosen action matches the branch safety level: local-only rewrite versus shared-history-safe revert
- Any forceful action was explicitly requested and gated by the relevant server setting
- Hook or CI failures were treated as real failures rather than bypassed casually

For multi-step or risky work, keep a short checklist in your scratchpad and update it as you go.

## Playbooks

Read `references/workflow-playbooks.md` for:

- simple feature branch flow
- review-fix and safe rebase flow
- recovery after a bad reset or rebase
- worktree setup guidance
- backport and release tagging playbooks
- hooks and CI guidance

If the user wants conceptual Git explanations, read `references/git-concepts.md`.

## Repository-Specific Notes for `git-mcp`

When contributing to this repository itself:

- Use Conventional Commits
- Prefer the documented tool groups in `docs/tools/`
- Run the full gate before declaring work done:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
- Remember that the project uses `simple-git`, Zod schemas, and safety-first defaults

## References

- `references/tooling-map.md`
- `references/workflow-playbooks.md`
- `references/git-flow-next.md`
- `references/shell-safety.md`
- `references/git-concepts.md`
- `docs/tools/index.md`
- `docs/guide/safety.md`
- `docs/development/contributing.md`
