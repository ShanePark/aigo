---
name: git-commit
description: Prepare, review, and create git commits safely in existing repositories. Use when Codex needs to handle commit-related requests such as checking status and diffs, selecting files to stage, composing English commit messages with required prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), running git add or git commit, splitting mixed changes into multiple commits, ensuring only files modified in the current task are committed, or validating commit output before reporting back.
---

# Git Commit

## Overview

Create focused, reversible commits with clear English messages. Enforce required prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), commit only files touched in the current task, and use non-interactive git commands.

## Workflow

1. Inspect repository state.
- Run `git status --short` and `git branch --show-current`.
- Identify untracked, modified, deleted, and already staged files.
- If commit scope is unclear because of unrelated changes, ask the user to confirm scope before staging.

2. Build an explicit stage allowlist.
- Track the set of files edited during the current task (the files Codex actually modified in this conversation).
- Use this set as `allowed_paths` for staging.
- Treat all other dirty files as out of scope unless the user explicitly expands scope.

3. Review changes before staging.
- Run `git diff -- <path>` only for `allowed_paths`.
- Run `git diff --staged` to verify staged contents.
- Group files into one logical change per commit.

4. Stage with intent.
- Use `git add <file>` for full-file staging, restricted to `allowed_paths`.
- Use `git add -p` when a file includes multiple concerns and only part should be committed.
- Never use broad staging commands such as `git add .`, `git add -A`, or `git commit -a`.
- Use `git restore --staged <file>` to undo accidental staging.

5. Validate staged scope.
- Run `git diff --staged --name-only`.
- Ensure every staged file is in `allowed_paths`.
- If extra files appear, unstage them immediately and re-check.

6. Compose the commit message.
- Keep all commit messages in English.
- Require one of these prefixes at the start of the subject: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Use the format: `<prefix> <imperative summary>`.
- Keep subject line concise and imperative (target: <= 72 characters).
- Add a body when context, risk, migration, or behavior change needs explanation.

7. Commit non-interactively.
- Use `git commit -m "<subject>"`.
- Add `-m "<body>"` for multi-line messages when needed.
- Do not amend (`--amend`) unless the user explicitly asks.

8. Verify and report.
- Run `git show --stat --oneline -1` after committing.
- Summarize commit hash, message, and touched files in the final response.
- If hooks or checks fail, report the exact failure and propose the smallest practical fix.

## Safety Rules

- Never run destructive history commands (for example `git reset --hard`) unless explicitly requested.
- Never force-push or rewrite history unless explicitly requested.
- Avoid staging secrets, lockfile churn, generated artifacts, or binary files unless the user requests them.
- Preserve unrelated work already present in the working tree.
- Never include files untouched by the current task unless the user explicitly asks to include them.

## Commit Splitting Guide

When one working tree contains multiple concerns:

1. Stage only concern A.
2. Commit concern A with a dedicated message.
3. Repeat for concern B and later concerns.

Prefer multiple small commits over one mixed commit when it improves reviewability and rollback safety.
