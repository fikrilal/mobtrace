# Milestone 4: Maestro Vertical Slice

Date: 2026-06-12
Owner: Codex
Status: Active
Risk class: medium
Related issue/PR: N/A

## Objective

Implement the first useful `mobtrace verify --flow <flow>` vertical slice,
retaining run artifacts and enough structured evidence to distinguish runner
journey failures from MobTrace/tooling failures.

## Contract References

- `docs/contracts/cli.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`
- `docs/engineering/implementation-plan.md`

## Current State

Milestone 3 provides configuration resolution, artifact storage, process
execution, Git source capture, and hook execution foundations. There is no
verify command, runner integration, result generation, or compact output.

## Constraints

- Architecture constraints: keep Commander thin; route external execution
  through the process boundary; keep Maestro-specific behavior out of generic
  lifecycle orchestration.
- Product/runtime constraints: preserve runner exit evidence; run cleanup after
  attempted journeys; keep stdout parseable; keep raw evidence available after
  failures.
- Out of scope: advanced diagnosis, suspicious-file ranking, known signatures,
  report regeneration, `mobtrace report`, CI, and real device auto-selection.

## Acceptance Criteria

1. `mobtrace verify --flow <path>` creates a run, captures source evidence,
   runs hooks where configured, runs the journey, and finalizes lifecycle
   phases.
2. Maestro execution stores runner stdout, stderr, and normalized result
   artifacts using fake-Maestro integration tests.
3. Initial `result.json`, `report.md`, compact stdout, and `--json` output are
   produced for pass and failure.
4. The implementation is split into three commits:
   - `feat(verify): orchestrate run lifecycle`
   - `feat(maestro): execute flow and retain runner evidence`
   - `feat(report): emit initial result and compact output`

## Implementation Checklist

- [x] Commit 1: add verify lifecycle orchestration with fake journey runner.
- [x] Commit 1: add lifecycle phase and exit-precedence tests.
- [x] Commit 1: update architecture map and verify.
- [ ] Commit 2: add Maestro runner integration and fake Maestro tests.
- [ ] Commit 2: wire `verify` command to runner execution.
- [ ] Commit 3: add initial result/report generation and compact output.
- [ ] Commit 3: add CLI stdout/stderr/exit tests.
- [ ] Commit 3: complete docs and run full verification.

## Decision Log

- 2026-06-12: Split lifecycle, runner, and output/report commits -> each layer
  can be reviewed independently and tested without real devices.
- 2026-06-12: Keep advanced diagnosis out of Milestone 4 -> the milestone
  proves evidence retention before ranking or inference.

## Verification

```bash
npm run verify:full
```

Outcome after commit 1 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 13 test files passed, 71 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

## Runtime Evidence

Fake Maestro evidence is sufficient for this milestone. Real Maestro smoke can
be added after the CLI path is stable.

## Risks And Mitigations

- Risk: verify grows into a monolith.
- Mitigation: separate lifecycle orchestration, runner integration, and report
  rendering.
- Risk: early result fields become hard to change.
- Mitigation: use existing report schemas and keep unsupported diagnosis fields
  explicitly generic.

## Completion Notes

Pending.

## Follow-Ups

- [ ] Implement advanced deterministic diagnosis in a later milestone.
