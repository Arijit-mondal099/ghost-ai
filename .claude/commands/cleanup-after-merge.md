---
description: After a PR is merged, switch to the default branch, fast-forward it, verify the feature branch was actually merged, then delete it locally and remotely
argument-hint: [branch-name] # optional — defaults to the current branch
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git symbolic-ref:*), Bash(git remote:*), Bash(git checkout:*), Bash(git fetch:*), Bash(git merge:*), Bash(git push:*), Bash(git rev-parse:*), Bash(git ls-remote:*), Bash(git log:*), AskUserQuestion
---

## Context

- Default branch: !`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main`
  <!-- sed requires Git Bash on Windows (win32); fallback to `echo main` keeps the command portable -->
- Current branch: !`git branch --show-current`
- Status: !`git status --short`
- Origin remote: !`git remote get-url origin`
- Note: `gh` CLI is not installed in this environment — do not use `gh` commands; use `git` only (`gh` will fail with `command not found`)

## Task

You are running `/cleanup-after-merge $ARGUMENTS`. Follow these steps in order. Do not skip the pause point — it is a hard stop, not a suggestion.

> **Environment constraint:** `gh` is not installed — do not invoke `gh pr view`, `gh api`, or any `gh` subcommand. Rely solely on `git` (`ls-remote`, `branch --merged`, `log`) for merge verification as described below.

### 1. Resolve target branch

- Target = `$ARGUMENTS` if provided, otherwise the current branch (`git branch --show-current`).
- If `git branch --show-current` is empty (detached HEAD) and no argument was given, stop and ask the user to specify a branch name.
- If the resolved target **is** the default branch, stop immediately and tell the user there's nothing to clean up — pass an explicit branch name if you meant to clean up a different branch.

### 2. Refuse a dirty working tree

If `git status --short` is non-empty, **abort immediately**. Do not stash, do not discard, do not proceed. Tell the user to commit, stash, or discard their changes manually first, then re-run the command.

### 3. Fetch latest

Run `git fetch origin --prune` (prune removes stale `origin/<branch>` tracking refs after GitHub auto-deletes the head branch).

### 4. Switch to the default branch

If not already on it, run `git checkout <default-branch>`.

### 5. Fast-forward only — no silent merge commits

Run `git merge --ff-only origin/<default-branch>`.

- If this fails (local default branch has diverged from origin and can't fast-forward), **stop and fail loudly**. Show the user the divergence (`git log --oneline <default-branch>..origin/<default-branch>` and the reverse) and let them resolve it manually. Do not fall back to a regular merge or rebase on their behalf.

### 6. Verify the target branch exists and was actually merged

First, verify the branch exists at all (otherwise the "not merged" message is misleading):

- Run `git rev-parse --verify <target>` to check for a local branch.
- Run `git ls-remote --heads origin <target>` to check for a remote branch.
- If neither exists, stop and tell the user the branch was not found locally or on `origin`.

Then, verify merge status:

- Run `git branch --merged <default-branch>` and check the target branch appears in the list.
- If it does **not** appear, **refuse to delete anything**. Tell the user the branch doesn't look merged into `<default-branch>` yet (it may have been squash-merged under a different mechanism, or the PR isn't actually merged) and stop here.
- Squash-merge note: `git branch --merged` won't recognize a squash-merged branch as merged even though GitHub shows the PR as merged. If the check fails, mention this possibility to the user explicitly rather than just reporting a bare "not merged."

### 7. Confirm deletion (PAUSE — requires approval via AskUserQuestion)

Show the user:

- The branch about to be deleted
- Confirmation that it was found in `--merged` output (or the squash-merge caveat if you couldn't confirm this way and the user is overriding)

**Stop and call `AskUserQuestion` to get explicit approval before deleting anything, local or remote.** Do not proceed without it.

Example:

```json
AskUserQuestion({
  "questions": [{
    "question": "Delete branch '<target>' locally and on origin? (verified merged into <default-branch>)",
    "header": "Confirm deletion",
    "options": [
      { "label": "Yes, delete", "description": "Delete local and remote branch" },
      { "label": "No, keep", "description": "Abort without deleting" }
    ]
  }]
})
```

### 8. Delete local branch

Run `git branch -d <target>` (safe delete — will fail on its own if somehow unmerged, as a second safety net). Do not fall back to `git branch -D`; if `-d` fails, stop and report the error.

### 9. Delete remote branch

- First check whether the remote branch still exists: `git ls-remote --heads origin <target>`.
- If it's already gone (many repos auto-delete the head branch on merge), skip this step and note it in the summary rather than treating it as an error.
- Otherwise run `git push origin --delete <target>`.

### 10. Report

Summarize:

- Branch deleted locally: yes/no
- Branch deleted remotely: yes/no/already-gone
- Current branch and its position relative to `origin/<default-branch>` (should be up to date)
