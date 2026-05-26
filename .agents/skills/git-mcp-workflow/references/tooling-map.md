# git-mcp Tooling Map

This reference translates common Git intentions into the correct `git-mcp` tool calls.

> **Never use `git` directly via the shell.** LLMs produce subtly malformed quoting that causes silent failures: commit messages truncated at the first space, arguments interpreted as flags, multi-line text collapsed, paths broken by word-splitting. The `git-mcp` server passes arguments directly to `simple-git` as a typed array—no shell, no quoting hazards, no silent corruption. Use these tools exclusively.

## Canonical Tool Surface

The server exposes **7 grouped tools** plus `git_flow`, `git_lfs`, `git_docs`, and `git_ping`. These are the only tools available. Use them exclusively.

---

## `git_context` — Repository context, config, and search

**`action=summary`** (default)

- High-signal snapshot: branch, upstream, dirty state, in-progress merge/rebase/cherry-pick/bisect
- Use as the default first call before any non-trivial operation

**`action=search`**

- Pickaxe/grep search across history; requires `query`
- Use for bug archaeology and "when was this added?" questions

**`action=get_config`**

- Read git config; pass `key` for a specific entry, omit for all local config

**`action=set_config`**

- Write a local git config entry; requires `key` and `value`

**`action=aliases`**

- List all git aliases configured in the repo

---

## `git_status` — Working tree state and diffs

**`action=status`** (default)

- Working tree and index state: modified, staged, untracked, conflict markers

**`action=diff`**

- Show a diff; controlled by `mode`:
  - `unstaged` (default): changes not yet staged
  - `staged`: changes in the index
  - `refs`: diff between two refs; requires `from_ref` and `to_ref`
- `filtered=true` for an LLM-friendly trimmed view

**`action=diff_main`**

- Diff of current branch vs `base_branch` (default `main`) using `merge-base`
- Use before PR creation to see all branch-specific changes

---

## `git_history` — Commit history, blame, and reflog

**`action=log`** (default)

- Paginated commit log; filter with `author`, `grep`, `since`, `until`, `file_path`
- Advanced: `first_parent`, `no_merges`, `all_branches`, `simplify_merges`, `order` (default/topo/date/author-date), `revision_range`, `pathspecs`
- Paginate with `limit` (max 200) and `offset`

**`action=show`**

- Full patch and metadata for a commit, tag, or ref; requires `ref`

**`action=reflog`**

- Local HEAD and ref movement history; safety net before any history rewrite
- Paginate with `limit`

**`action=blame`**

- Line-level author attribution; requires `file_path`; optional `ref`

**`action=lg`**

- One-line decorated graph of all branches (`--oneline --graph --decorate --all`)
- Good for a visual overview of branch topology before rebasing or merging

**`action=who`**

- Contributor shortlog sorted by commit count; optionally scope to `file_path`

---

## `git_commits` — Staging, committing, and undoing

**`action=add`**

- Stage files; `all=true` stages everything; `paths` for specific files/dirs

**`action=restore`**

- Restore paths from index or a ref; requires `paths`
- `staged=true, worktree=false` → unstage only (keeps working tree edits)
- `staged=false, worktree=true` → discard working tree changes
- `source` → restore from a specific ref

**`action=commit`**

- Create a commit; requires `message`
- Optional: `all=true` (auto-stage tracked), `sign=true`, `signing_key`, `no_verify`

**`action=reset`**

- Reset to a ref; `mode`: `soft` / `mixed` (default) / `hard`
- `target` defaults to HEAD; `paths` for path-limited mixed reset
- Hard reset requires `confirm=true`

**`action=revert`**

- Create a revert commit for `ref`; use for shared/published history
- `no_commit=true` stages the revert without committing
- `mainline` for merge commits (1 = first parent)

**`action=undo`** (convenience)

- Soft reset to HEAD~1; keeps changes staged; no extra params needed

**`action=nuke`** (convenience, destructive)

- Hard reset to HEAD~1; discards the last commit AND all working changes; requires `confirm=true`

**`action=wip`** (convenience)

- Stages all files and commits with message "WIP"; quick context save before context switch

**`action=unstage`**

- Moves staged files back to unstaged; requires `paths`

**`action=amend`**

- Amends the last commit; set `message` to change it, omit + `no_edit=true` to keep it
- Optional: `sign`, `signing_key`, `no_verify`

---

## `git_branches` — Branch lifecycle

**`action=list`** (default)

- Local branches; `all=true` includes remote-tracking refs

**`action=create`**

- Create a branch; requires `name`; `from_ref` sets start point; `create=true` checks it out immediately

**`action=delete`**

- Delete a local branch; requires `name`; `force=true` bypasses merge check

**`action=rename`**

- Rename a branch; requires `old_name` and `new_name`

**`action=checkout`**

- Switch to a branch, tag, or commit; requires `ref`; `create=true` creates the branch first

**`action=set_upstream`**

- Set a tracking upstream; requires `branch` and `upstream` (e.g. `origin/main`)

**`action=recent`**

- List N most recently committed branches; defaults to 10; max 100
- Useful for orientation after returning to a repo

---

## `git_remotes` — Network and remote transport

**`action=list`** (default)

- List configured remotes with fetch and push URLs

**`action=manage`**

- Add, remove, or change a remote; requires `remote_action` (`add`/`remove`/`set-url`) and `name`
- `url` required for `add` and `set-url`

**`action=fetch`**

- Fetch from remote; optional `remote`, `branch`, `prune` (default true)
- Advanced: `prune_tags`, `negotiation_tips`, `refspecs`

**`action=pull`**

- Pull from remote; optional `remote`, `branch`, `rebase`, `ff_only`
- Advanced: `rebase_mode` (`default`/`merges`/`interactive`), `refspecs`

**`action=push`**

- Push to remote; optional `remote`, `branch`, `set_upstream`, `tags`
- Safe force: `force_with_lease=true`
- Hard force: `force=true` — requires `GIT_ALLOW_FORCE_PUSH=true` server config; disallowed by default
- Hook bypass: `no_verify=true` — requires `GIT_ALLOW_NO_VERIFY=true` server config; disallowed by default
- Advanced: `refspecs`, `push_options`, `atomic`

---

## `git_workspace` — Stash, rebase, cherry-pick, merge, bisect, tag, worktree, submodule

### `action=stash`

- `stash_action`: `save` / `list` / `apply` / `pop` / `drop`
- `message`: optional stash label; `index`: stash slot for apply/pop/drop
- `include_untracked=true`: include untracked files in save

### `action=stash_all` (convenience)

- Stages all untracked files then stashes everything; equivalent to `git stash -u`
- Optional `message`

### `action=rebase`

- `rebase_action`: `start` / `continue` / `abort` / `skip`
- For start: `rebase_upstream` (required) is the base ref to rebase onto
- Onto rebasing: set both `rebase_onto` (new base) and `rebase_upstream` (old base)
- `rebase_branch`: optional branch to rebase (defaults to HEAD)
- Flags: `rebase_interactive`, `rebase_autosquash`, `rebase_merges`

### `action=cherry_pick`

- `cherry_pick_action`: `start` / `continue` / `abort`
- For start: `cherry_pick_refs` (array of SHAs) or `ref` (single commit)
- Flags: `cherry_pick_mainline` (for merge commits), `cherry_pick_record_origin` (-x), `cherry_pick_no_commit`
- Advanced: `cherry_pick_strategy`, `cherry_pick_strategy_options`

### `action=merge`

- `merge_action`: `start` / `continue` / `abort`
- For start: `merge_refs` (array) or `ref` (single)
- Flags: `merge_no_ff`, `merge_ff_only`, `merge_squash`, `merge_no_commit`, `merge_log`
- Advanced: `merge_strategy`, `merge_strategy_options`, `conflict_style` (`merge`/`diff3`/`zdiff3`)

### `action=bisect`

- `bisect_action`: `start` / `good` / `bad` / `skip` / `run` / `reset`
- For start: `good_ref` and `bad_ref`
- For `run`: `command` (shell command run at each bisect step)
- `ref`: for manual good/bad/skip marking mid-session

### `action=tag`

- `tag_action`: `list` / `create` / `delete`
- For create: `name` required; `target` (defaults HEAD), `message` for annotated, `sign`, `signing_key`

### `action=worktree`

- `worktree_action`: `add` / `list` / `remove` / `lock` / `unlock` / `prune` / `repair`
- For add: `path` (required), `branch`; flags: `worktree_force`, `worktree_detached`, `worktree_lock_reason`
- For remove: `path` (required), `worktree_force`
- For lock/unlock: `path` (required); lock accepts `worktree_lock_reason`
- For prune: `worktree_expire` (e.g. `2.weeks.ago`)
- For repair: `paths` (array of worktree paths to repair)

### `action=submodule`

- `submodule_action`: `add` / `list` / `update` / `sync` / `foreach` / `set_branch`
- For add: `url` and `path` required
- For update: `recursive` (default true), `submodule_remote`, `submodule_depth`, `submodule_jobs`; optional `paths`
- For foreach: `command` required, `recursive`
- For set_branch: `branch` and `path` required

---

## `git_flow` — Git Flow and git-flow-next workflows

- `operation=overview` or `action=overview`: show current flow state before mutating
- Canonical form: `operation` (`init`/`overview`/`config`/`topic`/`control`) + sub-action
  - `topic_action`: `start`/`finish`/`publish`/`list`/`update`/`delete`/`rename`/`checkout`/`track`
  - `control_action`: `continue` / `abort` (when a finish pauses on a conflict)
  - `config_action`: `add`/`update`/`rename`/`delete`

- Key params: `topic` (branch type), `name`, `start_point`, `base_ref`, `preset` (classic/github/gitlab)
- Merge/integration: `upstream_strategy`, `downstream_strategy`, `ff`, `keep_branch`, `rebase_before_finish`, `publish`
- Set `GIT_ALLOW_FLOW_HOOKS=true` in the server environment to allow hook execution

---

## `git_lfs` — Large File Storage

**actions**: `track` / `untrack` / `ls-files` / `status` / `pull` / `push` / `install` / `migrate-import` / `migrate-export`

- `patterns`: glob array for track/untrack
- `remote`: for pull/push
- `include` / `exclude`: comma-separated patterns for migrate and pull
- `everything=true`: include all refs in push/migrate

---

## `git_docs` — Official Git documentation

**`action=search`**

- Full-text search of git-scm.com; `query` = search terms

**`action=man`**

- Fetch the man page for a command; `query` = command name without `git-` prefix (e.g. `rebase`, `commit`)

---

## `git_ping`

- Health check; no required parameters. Returns server name and a configurable `message`.

---

## Quick-reference cheat-sheet

| Intent                   | Tool            | Key params                                                             |
| ------------------------ | --------------- | ---------------------------------------------------------------------- |
| Orient to repo           | `git_context`   | `action=summary`                                                       |
| Search history           | `git_context`   | `action=search, query=...`                                             |
| Read config              | `git_context`   | `action=get_config, key=...`                                           |
| Working tree status      | `git_status`    | `action=status`                                                        |
| Unstaged diff            | `git_status`    | `action=diff, mode=unstaged`                                           |
| Staged diff              | `git_status`    | `action=diff, mode=staged`                                             |
| Branch vs main diff      | `git_status`    | `action=diff_main`                                                     |
| Commit log               | `git_history`   | `action=log`                                                           |
| Graph view               | `git_history`   | `action=lg`                                                            |
| Show a commit            | `git_history`   | `action=show, ref=...`                                                 |
| Reflog (recovery)        | `git_history`   | `action=reflog`                                                        |
| Blame a file             | `git_history`   | `action=blame, file_path=...`                                          |
| Who contributed          | `git_history`   | `action=who`                                                           |
| Stage files              | `git_commits`   | `action=add, paths=[...]`                                              |
| Stage all                | `git_commits`   | `action=add, all=true`                                                 |
| Unstage                  | `git_commits`   | `action=unstage, paths=[...]`                                          |
| Discard working changes  | `git_commits`   | `action=restore, paths=[...], worktree=true`                           |
| Commit                   | `git_commits`   | `action=commit, message=...`                                           |
| Amend                    | `git_commits`   | `action=amend`                                                         |
| Soft undo                | `git_commits`   | `action=undo`                                                          |
| Quick WIP save           | `git_commits`   | `action=wip`                                                           |
| Revert shared commit     | `git_commits`   | `action=revert, ref=...`                                               |
| List branches            | `git_branches`  | `action=list`                                                          |
| Recent branches          | `git_branches`  | `action=recent`                                                        |
| Create branch            | `git_branches`  | `action=create, name=..., from_ref=..., create=true`                   |
| Switch branch            | `git_branches`  | `action=checkout, ref=...`                                             |
| Delete branch            | `git_branches`  | `action=delete, name=...`                                              |
| Set upstream             | `git_branches`  | `action=set_upstream, branch=..., upstream=...`                        |
| Fetch                    | `git_remotes`   | `action=fetch`                                                         |
| Pull                     | `git_remotes`   | `action=pull`                                                          |
| Pull with rebase         | `git_remotes`   | `action=pull, rebase=true`                                             |
| Push                     | `git_remotes`   | `action=push`                                                          |
| Safe force push          | `git_remotes`   | `action=push, force_with_lease=true`                                   |
| Stash all incl untracked | `git_workspace` | `action=stash_all`                                                     |
| Save stash               | `git_workspace` | `action=stash, stash_action=save`                                      |
| Pop stash                | `git_workspace` | `action=stash, stash_action=pop`                                       |
| Rebase onto upstream     | `git_workspace` | `action=rebase, rebase_action=start, rebase_upstream=...`              |
| Cherry-pick              | `git_workspace` | `action=cherry_pick, cherry_pick_action=start, cherry_pick_refs=[...]` |
| Merge branch             | `git_workspace` | `action=merge, merge_action=start, merge_refs=[...]`                   |
| Bisect                   | `git_workspace` | `action=bisect, bisect_action=start, good_ref=..., bad_ref=...`        |
| Create annotated tag     | `git_workspace` | `action=tag, tag_action=create, name=..., message=...`                 |
| Add worktree             | `git_workspace` | `action=worktree, worktree_action=add, path=..., branch=...`           |
| Git Flow feature start   | `git_flow`      | `operation=topic, topic_action=start, topic=feature, name=...`         |
| Git Flow release finish  | `git_flow`      | `operation=topic, topic_action=finish, topic=release, name=...`        |
| LFS track patterns       | `git_lfs`       | `action=track, patterns=[...]`                                         |
| Read git man page        | `git_docs`      | `action=man, query=rebase`                                             |

---

## Safety defaults

- Always call `git_context action=summary` before mutating
- Prefer `git_commits action=revert` over reset for published history
- Capture `git_history action=reflog` before risky history changes
- Prefer `force_with_lease=true` on `git_remotes action=push` over `force=true`
- Hard reset and `action=nuke` require `confirm=true`
- Do not set `no_verify=true` unless the user explicitly requests it and `GIT_ALLOW_NO_VERIFY=true` is set server-side

---

## Capabilities not covered by git-mcp

Use adjacent tooling or, if unavoidable, the shell only for:

- Interactive patch staging (`git add -p`)
- Interactive rebase editing (squash/fixup/reword/reorder/drop choreography needing a text editor)
- Repository-wide history rewriting (`git filter-repo`)
- GitHub PR lifecycle and release object management
- Project-specific hook installation commands
