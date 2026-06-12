# Parallel Agent Workflow

Status: Accepted

## Purpose

This guide defines how multiple agents work concurrently without mixing
changes, generated output, or verification evidence.

## Preferred Isolation

Use, in order:

1. one Git worktree and branch per task
2. separate clones and branches
3. one shared working tree only as a last resort

Example:

```bash
git fetch origin
git worktree add ../mobtrace-config -b agent/config
git worktree add ../mobtrace-artifacts -b agent/artifacts
```

Each agent should run verification in its own worktree.

## High-Contention Paths

Only one agent should own these at a time:

- `package.json`
- `package-lock.json`
- `AGENTS.md`
- public contracts
- architecture and guardrail documents
- shared test fixtures
- release configuration
- generated baselines or reports

## Shared Working Tree Rules

When isolation is impossible:

- assign explicit path ownership
- do not use `git add .`
- stage and commit only explicit paths
- do not revert unrelated changes
- avoid repository-wide formatting unless required
- do not regenerate shared artifacts owned by another task
- stop when another agent is editing the same file

Before handoff:

```bash
git status --short
git diff --stat
```

## Integration

Keep one integration branch and merge or cherry-pick reviewed task commits.

Prefer cherry-picking when only part of an agent branch should be accepted.

## Verification

Every agent records checks from its own task branch or worktree.

A passing result from a different dirty working tree is not evidence for the
current change.
