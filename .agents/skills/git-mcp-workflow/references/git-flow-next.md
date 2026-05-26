# Git Flow Next Usage

This document maps standard Git Flow command line actions to Git MCP tools and actions.

## Initialization and presets

- `git flow init` → `operation: "init"`
- `git flow init --preset=github` → `operation: "init", preset: "github"`
- `git flow init --preset=gitlab` → `operation: "init", preset: "gitlab"`
- `git flow init --main <branch>` → `operation: "init", main_branch: "<branch>"`
- `git flow init --develop <branch>` → `operation: "init", develop_branch: "<branch>"`
- `git flow init --custom` → initialize, then apply explicit `operation: "config"` updates (base/topic definitions) instead of interactive prompts.

## Branch type customization

- `--feature <prefix>` → `operation: "config", config_action: "add|update", branch_kind: "topic", name: "feature", prefix: "<prefix>"`
- `--release <prefix>` → same pattern with `name: "release"`
- `--hotfix <prefix>` → same pattern with `name: "hotfix"`

## Topic branch lifecycle (`feature|bugfix|release|hotfix|support`)

- `git flow <topic> start <name> [<base>]`
  → `operation: "topic", topic: "<topic>", topic_action: "start", name: "<name>", base_ref: "<base?>"`
- `git flow <topic> list`
  → `operation: "topic", topic: "<topic>", topic_action: "list"`
- `git flow <topic> update [<name>]`
  → `operation: "topic", topic: "<topic>", topic_action: "update", name: "<name?>"`
- `git flow <topic> delete <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "delete", name: "<name>"`
- `git flow <topic> rename <old> <new>`
  → `operation: "topic", topic: "<topic>", topic_action: "rename", name: "<old>", new_name: "<new>"`
- `git flow <topic> checkout <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "checkout", name: "<name>"`
- `git flow <topic> finish <name>`
  → `operation: "topic", topic: "<topic>", topic_action: "finish", name: "<name>"`

## Finish options mapping

Use with `operation: "topic", topic_action: "finish"`:

- `--rebase` → `strategy: "rebase"` (or `rebase_before_finish: true` when policy requires)
- `--squash` → `strategy: "squash"`
- `--no-ff` → `ff: false`
- `--tag` → `tag: true` (optional `tag_message`)
- `--keep` → `keep_branch: true` (or `delete_branch: false`)
- `--force` → `force: true`
- `--abort` → `operation: "control", control_action: "abort"`
- `--continue` → `operation: "control", control_action: "continue"`

## Flow models and when to use

- Traditional Git Flow: base `main` + `develop`; topics `feature/`, `bugfix/`, `release/`, `hotfix/`, optional `support/`.
- GitHub Flow: single base `main`; use `feature/*` for all work.
- GitLab Flow: base branches `main`, `staging`, `production`; topic types usually `feature/` and `hotfix/`.

Represent these with `operation: "init"` presets (`classic|github|gitlab`) plus `operation: "config"` adjustments as needed.

## Configuration and status commands

- `git flow config` / `git flow config list`
  → `operation: "config", config_action: "list"`
- `git flow config add base <name>`
  → `operation: "config", config_action: "add", branch_kind: "base", name: "<name>"`
- `git flow config add topic <name> <parent>`
  → `operation: "config", config_action: "add", branch_kind: "topic", name: "<name>", parent: "<parent>"`
- `git flow config edit base <name>`
  → `operation: "config", config_action: "update", branch_kind: "base", name: "<name>"`
- `git flow config rename topic <old> <new>`
  → `operation: "config", config_action: "rename", branch_kind: "topic", name: "<old>", new_name: "<new>"`
- `git flow config delete topic <name>`
  → `operation: "config", config_action: "delete", branch_kind: "topic", name: "<name>"`
- `git flow overview`
  → `operation: "overview"`

If a desired CLI subcommand has no direct `git_flow` equivalent, use other `git-mcp` tools (`git_branches`, `git_status`, `git_history`, `git_commits`) before considering raw CLI.
