# Shell safety for Git operations

Do not run `git` directly in a shell when a `git-mcp` tool exists.

## Why this matters

Shell Git commands are a poor fit for agent execution because commit messages, branch names, refs, and file paths often contain spaces, quotes, newlines, or characters that shells interpret specially.

Common failure modes:

- commit messages truncated at the first space or quote
- arguments interpreted as flags
- multiline messages collapsed or silently dropped
- word-splitting breaking file paths with spaces
- quote nesting errors that leave the shell waiting for input
- accidental command substitution from `$` or backticks

These failures are often silent: the command may appear to work while producing the wrong result.

## Safe default

Use `git-mcp` tools instead. Their inputs are typed, validated, and passed as structured argument arrays without shell interpolation.

## Narrow exceptions

Only consider shell Git as a last resort when no MCP tool covers the operation, such as:

- interactive patch staging
- interactive rebase editing
- deep history surgery with tools outside the MCP surface
- repo-local hook installation commands

Even in those cases, exhaust the MCP tool surface first and explain the risk before proceeding.
