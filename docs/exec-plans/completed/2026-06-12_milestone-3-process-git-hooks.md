# Milestone 3: Process, Git, And Hook Infrastructure

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Build the external process, Git source evidence, and hook foundations required
before MobTrace can run Maestro journeys safely.

## Contract References

- `docs/contracts/cli.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`
- `docs/engineering/implementation-plan.md`

## Current State

Milestone 2 provides strict configuration loading, flow resolution, `init`, and
static `doctor`. Product code does not yet have a reusable subprocess boundary,
Git source evidence capture, or hook execution.

## Constraints

- Architecture constraints: all product subprocess usage must go through one
  tested boundary.
- Product/runtime constraints: execute directly without a shell by default;
  retain stdout and stderr separately; redact configured secrets from command
  summaries and persisted normalized output.
- Out of scope: Maestro journey orchestration, final report generation, device
  probing, and CI.

## Acceptance Criteria

1. A centralized process executor captures stdout/stderr, duration, exit code,
   signals, launch failures, timeout, and redacted command summaries.
2. Git source evidence captures worktree metadata, changed files, untracked
   readable files, and unified diff artifacts from a configured baseline.
3. Project and flow hooks execute in documented order, parse the hook output
   protocol, retain independent hook artifacts, and run cleanup after failures
   where safe.
4. The implementation is split into two commits:
   - `feat(process): add subprocess executor and redaction`
   - `feat(source): capture git state and hook evidence`

## Implementation Checklist

- [x] Commit 1: add process executor and redaction.
- [x] Commit 1: add fake executable tests for stdout/stderr, non-zero exit,
      launch failure, timeout, signal, and redaction.
- [x] Commit 1: update architecture map and verify.
- [x] Commit 2: add Git source capture.
- [x] Commit 2: add hook execution and output parsing.
- [x] Commit 2: add Git and hook tests.
- [x] Commit 2: complete docs and run full verification.

## Decision Log

- 2026-06-12: Split process execution from Git/hooks -> keeps the first review
  focused on the most important boundary.
- 2026-06-12: Keep harness `scripts/process.ts` separate -> product runtime
  needs stricter timeout, signal, and redaction semantics.

## Verification

```bash
npm run verify:full
```

Outcome after commit 1 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 10 test files passed, 61 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

Outcome after commit 2 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 12 test files passed, 66 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

## Runtime Evidence

Not required until Maestro journey execution exists.

## Risks And Mitigations

- Risk: hook execution leaks secrets into logs or reports.
- Mitigation: introduce redaction before hook execution and test it directly.
- Risk: source capture becomes a set of ad hoc Git calls.
- Mitigation: use the process executor for every Git command in commit 2.

## Completion Notes

Implemented Milestone 3 foundations:

- centralized subprocess executor with redaction
- Git source evidence capture with source artifacts
- hook lifecycle execution with output protocol parsing
- cleanup execution after preparation failure and after attempted journeys
- focused tests for process, source, and hook behavior

Maestro journey orchestration remains deferred to Milestone 4.

## Follow-Ups

- [ ] Upgrade `doctor` to use process-backed Git/Maestro version checks during
      the Maestro vertical slice.
