# Milestone 2: Configuration And Command Resolution

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Implement deterministic project discovery, strict `mobtrace.yaml` validation,
flow resolution, `init`, and non-runner `doctor` checks.

## Contract References

- `docs/contracts/cli.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`
- `docs/engineering/implementation-plan.md`

## Current State

The CLI exposes help/version only. Core report contracts and artifact storage
exist, but there is no project configuration loader, command resolution, or
environment readiness command.

## Constraints

- Architecture constraints: keep Commander thin; keep configuration parsing out
  of CLI presentation.
- Product/runtime constraints: invalid configuration must fail before external
  execution; `doctor --json` must print only JSON.
- Out of scope: Git source capture, subprocess execution, hook execution,
  Maestro runner invocation, report generation, and CI integration.

## Acceptance Criteria

1. `mobtrace init` creates a starter `mobtrace.yaml` and refuses overwrite
   unless `--force` is set.
2. `mobtrace doctor` validates project/configuration/static runtime readiness
   with human and JSON output.
3. Direct flow paths work without configuration, while named flows resolve
   through strict configuration with CLI overrides taking precedence.
4. Tests cover malformed YAML, unknown fields, precedence, discovery, init,
   doctor, and CLI stream/exit behavior.

## Implementation Checklist

- [x] Add strict configuration schemas and YAML loading.
- [x] Add project/config discovery and flow resolution.
- [x] Add `init` command.
- [x] Add `doctor` command and JSON result shape.
- [x] Update architecture map and tests.
- [x] Run full repository verification.

## Decision Log

- 2026-06-12: Use `yaml` for parsing -> YAML is the public config format and
  comments must remain allowed.
- 2026-06-12: Keep `doctor` runtime checks static/PATH-based in this milestone
  -> subprocess execution belongs to Milestone 3.

## Verification

```bash
npm run verify:full
```

Outcome on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 9 test files passed, 54 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

## Runtime Evidence

Not required for this milestone. No mobile runner execution is implemented in
this slice.

## Risks And Mitigations

- Risk: configuration parsing becomes too broad before runner integration.
- Mitigation: implement only contract fields needed for deterministic loading,
  resolution, init, and doctor.

## Completion Notes

Implemented Milestone 2's deterministic configuration and command-resolution
slice:

- strict `mobtrace.yaml` schemas and YAML loading
- project root and config discovery
- direct-path and named-flow resolution
- CLI precedence for device and baseline
- `init`
- `doctor` human and JSON output
- doctor result schema
- tests for schema failures, discovery, precedence, init, doctor, and CLI
  streams/exit codes

Device availability remains skipped in `doctor` until the Milestone 3 process
boundary can own external command execution cleanly.

## Follow-Ups

- [ ] Revisit device availability in `doctor` after process/device runner
      boundaries exist.
