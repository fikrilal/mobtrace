# Gitignore Artifact Guard

Date: 2026-06-13
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Make the default retained artifact directory safe for installable use by adding
`.mobtrace/` during `init`, documenting the required ignore entry, and warning
from `doctor` when an in-repository artifact root is not ignored by Git.

## Contract References

- `docs/contracts/cli.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`

## Current State

`mobtrace init` creates `mobtrace.yaml` only. The default artifact root is
`.mobtrace/runs`, and real dogfood creates many retained files in the consuming
project. `doctor` validates artifact writability but does not check whether the
artifact root is ignored by Git.

## Constraints

- Architecture constraints: keep ignore handling in command-layer code; do not
  change artifact storage semantics.
- Product/runtime constraints: `verify` must not mutate `.gitignore`; `init`
  may write setup files.
- Out of scope: artifact cleanup, retention policies, interactive prompts, or
  project-specific adapter generation.

## Acceptance Criteria

1. `mobtrace init` creates or updates `.gitignore` with `.mobtrace/`.
2. `mobtrace init` does not duplicate an existing MobTrace ignore entry.
3. `doctor` reports a non-required warning when the resolved artifact root is
   inside a Git worktree and not ignored.
4. README and CLI contract document the ignore behavior.

## Implementation Checklist

- [x] Add `.gitignore` handling to `init`.
- [x] Add Git ignore detection to `doctor`.
- [x] Add tests for init and doctor behavior.
- [x] Update docs.
- [x] Run targeted and full verification.

## Decision Log

- 2026-06-13: Keep `init` non-interactive -> current CLI contract avoids
  prompts; safe idempotent `.gitignore` updates are acceptable setup behavior.
- 2026-06-13: Model doctor warning as a non-required failed check -> report
  schema has no warning state and readiness must remain true.

## Verification

```bash
npm test -- test/program.test.ts
npm run typecheck
npm run verify:full
```

All passed on 2026-06-13.

## Runtime Evidence

Not required beyond command tests; behavior is local filesystem and Git
inspection.

## Risks And Mitigations

- Risk: `doctor` blocks ready state for ignored-artifact advice.
- Mitigation: make the check non-required.
- Risk: `.gitignore` matching logic is too clever.
- Mitigation: `init` only handles the canonical `.mobtrace/` entry; `doctor`
  delegates actual ignore resolution to `git check-ignore`.

## Completion Notes

Implemented deterministic artifact ignore handling:

- `init` creates or updates `.gitignore` with `.mobtrace/`
- `init` avoids duplicate MobTrace ignore entries
- `doctor` emits a non-required failed `gitignore` check when an in-worktree
  artifact root is not ignored
- README and contracts document the behavior

## Follow-Ups

- [x] Move this plan to completed when done.
