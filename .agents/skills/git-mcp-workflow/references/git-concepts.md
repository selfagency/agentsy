# Explaining Git concepts with `git-mcp`

Use this reference when the user wants an explanation rather than an action.

## Core concepts

- **Working tree, index, and committed history**: explain what is changed now, what is staged, and what is already recorded.
- **Branches as movable refs**: a branch name points to a commit and moves when new commits are added.
- **`HEAD`**: the current checkout target.
- **Fast-forward versus merge commit**: whether history stays linear or records an explicit merge.
- **Local rewrite versus shared-history preservation**: rebase and reset rewrite local history; revert preserves shared history.
- **Reflog**: the recovery ledger for recent ref movements.

## Tool mapping for explanations

- staging and working tree: `git_status action=status`, `git_status action=diff`, `git_commits action=add`, `git_commits action=restore`
- commit history and refs: `git_history action=log`, `git_history action=show`, `git_branches action=list`, `git_history action=reflog`
- merge and rebase state: `git_context action=summary`, `git_workspace action=rebase`, `git_workspace action=cherry_pick`

## Explanation pattern

1. Name the concept in plain language.
2. Point to the `git-mcp` tool that reveals it.
3. Connect it to the user's task or risk.
4. If the task affects published history, call that out explicitly.
