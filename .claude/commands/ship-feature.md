---
description: Split working-tree changes into atomic conventional commits, then push and print a prefilled PR compare URL (no gh CLI required)
argument-hint: [branch-name] # required only when currently on the default branch
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(git log:*), Bash(git symbolic-ref:*), Bash(git remote:*), Bash(git checkout:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git ls-files:*), Bash(git rev-parse:*), Bash(bun run:*), Bash(python3:*), AskUserQuestion
disable-model-invocation: true
---

## Context

- Default branch: !`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main`
- Current branch: !`git branch --show-current`
- Status: !`git status --short`
- Staged diff: !`git diff --cached`
- Unstaged diff: !`git diff`
- Untracked files (names only — read content with cat/Read when planning): !`git ls-files --others --exclude-standard`
- Recent commit log (style reference): !`git log --oneline -15`
- Origin remote: !`git remote get-url origin`

## Task

You are running `/ship-feature $ARGUMENTS`. Follow these steps in order. Do not skip the pause points — they are hard stops, not suggestions.

### 1. Resolve branch state

- If **current branch == default branch**:
  - If `$ARGUMENTS` is empty, stop immediately and tell the user a branch name is required when on the default branch. Do not guess a name.
  - Otherwise run `git checkout -b "$ARGUMENTS"` from the current position (quoted to handle spaces/special chars).
- If **current branch != default branch**: this is already the feature branch. Do not create a new branch. If `$ARGUMENTS` was passed, note that it's being ignored since a branch already exists.
- If `git branch --show-current` is empty (detached HEAD), stop and ask the user to checkout a branch first.

### 2. Check there's anything to ship

If `git status --short` is empty (no staged, unstaged, or untracked changes), stop and tell the user there's nothing to commit. Do not proceed.

### 3. Propose an atomic commit plan (PAUSE — requires approval via AskUserQuestion)

Read the staged + unstaged diffs **and** the untracked files list. For any untracked file that appears in the plan, read its content with `Read` or `cat` before grouping — `git diff` does not include untracked files.

Group changed files into logical, self-contained commits. One concern per commit — don't lump an unrelated fix into a feature commit or vice versa.

If a single file clearly mixes two unrelated concerns, don't try to split it at the hunk level. Flag it in the plan and ask the user how they want it handled (still fine to ship as one commit if the concerns are genuinely coupled).

For each proposed commit, write:

- **Files included**
- **Subject line** — conventional-commit format `type(scope): subject`, all lowercase, no trailing period, ≤100 characters (matches this repo's commitlint config: `header-max-length: 100`, `subject-case: lower-case`)
- **Body** (only if the change needs explaining beyond the subject) — must have a blank line after the subject if present (`body-leading-blank`)

Present the full plan as a numbered list and **stop. Call `AskUserQuestion` to get explicit approval or requested changes before touching git.** Do not proceed until the user approves.

> Note: If any `!git diff` context was truncated, run `git diff --stat` and targeted `git diff -- <file>` to fill gaps before planning.

### 4. Execute the approved plan

For each commit in the approved plan, in order:

1. `git add -- <only the files for this commit>` (use `--` to handle filenames starting with `-`)
2. `git commit -m "<subject>" -m "<body if any>"`

Husky will run automatically:

- `pre-commit` runs `bun run lint && bun run fmt:check`. **If this fails:** inspect the error output to determine which step failed:
  - If `lint` (oxlint) failed: run `bun run lint:fix` once.
  - If `fmt:check` (oxfmt) failed: run `bun run fmt` once.
  - If both failed: run `bun run lint:fix` then `bun run fmt`.
    Then re-run `git add -- <same files>` and retry the commit exactly once. If it fails again, stop and show the user the error — do not loop further.
- `commit-msg` runs commitlint against your message. **If this fails:** stop and show the exact commitlint error. Don't guess-and-retry blindly — fix the message to satisfy the specific rule it flagged, then retry once.

### 5. Show log and request push approval (PAUSE — requires approval via AskUserQuestion)

Once all commits are made, show:

- The branch name
- `git log --oneline <default-branch>..HEAD` (the commits about to ship)

**Stop and call `AskUserQuestion` to get explicit go-ahead before pushing.** Do not push without approval.

### 6. Push + print compare URL

After approval:

1. Check if upstream is already set: `git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null`. If it succeeds, run `git push`; otherwise run `git push -u origin <branch>`.
2. Parse the origin remote URL into `<owner>/<repo>`, handling both `https://github.com/owner/repo.git` and `git@github.com:owner/repo.git` forms (strip optional `.git` suffix).
3. Build a synthesized PR title (concise summary of the overall change — not just the first commit's subject) and a body listing each commit subject as a bullet.
4. URL-encode title and body before interpolating (required for spaces/`&`/`#`):
   ```bash
   python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$title"
   python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$body"
   # use `python` instead of `python3` on Windows if needed
   ```
5. Print the compare URL, prefilled and ready to open:

   `https://github.com/<owner>/<repo>/compare/<default-branch>...<branch>?quick_pull=1&title=<url-encoded-title>&body=<url-encoded-body>`

No `gh` CLI is available — this URL is the deliverable. Opening it takes the user straight to a prefilled "Open pull request" page.
