# Milestone 7: Security And Reliability Hardening

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: high
Related issue/PR: N/A

## Objective

Make MobTrace's local execution and generated diagnosis trustworthy under
secret-bearing, oversized, malformed, and interrupted inputs.

## Contract References

- `docs/product/product.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`
- `docs/engineering/architecture.md`
- `docs/engineering/implementation-plan.md`
- `docs/engineering/testing-strategy.md`
- `docs/engineering/guardrails.md`

## Current State

MobTrace already captures raw subprocess evidence, normalizes run facts, and
generates deterministic JSON and Markdown diagnosis. Process execution has
timeouts and process-group termination, but retained output is unbounded.
Hook environment values can be redacted from command summaries, while
normalized and generated report content does not yet enforce one complete
redaction policy. Interrupted runs and corrupt optional evidence need explicit
runtime semantics and verification.

## Constraints

- Architecture constraints: preserve the current core boundaries and public
  report contracts; keep project-specific behavior outside the core.
- Product/runtime constraints: local-only operation, deterministic output, no
  hosted service or uploads, and honest platform support.
- Out of scope: AI summarization, remote telemetry, CI publishing, plugin
  systems, and automatic deletion of raw evidence.

## Acceptance Criteria

1. Known credential and token fixtures do not appear in normalized evidence,
   generated JSON, generated Markdown, or compact CLI output.
2. Raw evidence remains available when captured and is explicitly marked as
   sensitive and not fully redacted.
3. Subprocess output retention is bounded and reports truncation
   deterministically.
4. Interrupted runs terminate child processes, preserve partial evidence, run
   cleanup where possible, and remain reportable.
5. Corrupt optional evidence does not erase valid core evidence or prevent a
   report from being generated.
6. Supported and unsupported platform claims are documented and covered by
   automated checks.
7. Duration and repeated-run evidence are available without network access.

## Implementation Checklist

- [x] Enforce built-in and configured redaction for generated outputs.
- [x] Add bounded subprocess output capture with truncation metadata.
- [x] Add interruption propagation and partial-run finalization.
- [x] Harden malformed optional-artifact and hook-output handling.
- [x] Add platform support checks and reliability/duration evidence.
- [x] Run targeted tests and `npm run verify:full`.
- [x] Move this plan to `docs/exec-plans/completed/`.

## Decision Log

- 2026-06-12: Treat raw logs and source diffs as sensitive evidence rather than
  claiming they are fully redacted.
- 2026-06-12: Apply redaction before normalized evidence is persisted, then
  reapply serializable pattern rules during report generation.
- 2026-06-12: Cap each subprocess stream independently and preserve a
  deterministic truncation marker and counters.
- 2026-06-12: Represent user or agent interruption separately from timeout and
  ordinary runner failure.
- 2026-06-12: Claim release support only where automated evidence exists;
  describe unverified targets as provisional.

## Verification

Completed checks:

```bash
npm run verify:full
```

Result: passed on 2026-06-12. The canonical gate completed formatting, lint,
type-checking, 126 tests across 22 files, the production build, project-map
verification, isolated package installation and binary smoke, and gate-honesty
checks.

Targeted redaction, large-output, interruption, malformed-evidence, platform,
and repeated-run tests also passed before the full gate.

## Runtime Evidence

- Environment: Ubuntu Linux 24.04-derived host, kernel 6.17.0-35-generic,
  Node.js v22.22.0, npm 10.9.4.
- Executed scenario: credential redaction through a fake Maestro failure;
  bounded large streams; timeout and abort of disposable child processes;
  cleanup after an interrupted journey; malformed hook output; corrupt
  optional source-ranking evidence; 20 repeated subprocess executions.
- Artifact paths: tests used isolated temporary runs and removed them after
  assertions.
- Notes: macOS platform behavior is contract-tested but was not executed on a
  macOS host in this environment. Runtime verification is tracked separately.

## Risks And Mitigations

- Risk: incomplete redaction leaks secrets into durable generated artifacts.
- Mitigation: centralize generated-output redaction and test every generated
  surface with known secret fixtures.
- Risk: signal handling leaves child processes alive or skips cleanup.
- Mitigation: propagate an abort signal through subprocess execution, terminate
  process groups, and verify cleanup plus partial manifests.
- Risk: output limits hide the useful failure tail.
- Mitigation: retain deterministic bounded evidence and expose truncation
  metadata rather than silently dropping bytes.
- Risk: malformed optional inputs collapse otherwise useful diagnosis.
- Mitigation: isolate optional parsing and preserve required normalized facts.

## Completion Notes

Milestone 7 shipped in five focused implementation commits. Generated outputs
apply built-in and configured redaction, while raw logs and diffs remain
explicitly sensitive. Process capture is bounded with retained head and tail
context. Interruptions produce partial, reportable runs and still attempt
cleanup. Malformed optional inputs degrade diagnosis without erasing core
facts. Platform and local-only boundaries are documented and mechanically
checked.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.
