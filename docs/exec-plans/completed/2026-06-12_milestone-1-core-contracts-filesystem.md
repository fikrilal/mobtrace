# Milestone 1: Core Contracts And Filesystem Model

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Implement typed and runtime-validated report contracts plus safe local artifact
storage for creating and updating MobTrace run manifests.

## Contract References

- `docs/engineering/implementation-plan.md`, Milestone 1
- `docs/contracts/report.md`
- `docs/engineering/architecture.md`
- `docs/engineering/testing-strategy.md`

## Current State

MobTrace has a CLI foundation and full local harness but no domain models,
artifact paths, atomic persistence, or lifecycle manifest implementation.

## Constraints

- Architecture constraints: contracts, artifact storage, and CLI presentation
  remain separate.
- Product/runtime constraints: no new CLI commands or Maestro behavior.
- Out of scope: configuration loading, Git collection, subprocess execution,
  hooks, evidence normalization, diagnosis, and report rendering.

## Acceptance Criteria

1. `run.json` and `result.json` have runtime schemas and inferred TypeScript
   types matching the v0.1 report contract.
2. Run IDs use UTC timestamp plus six lowercase hexadecimal characters.
3. Artifact and run paths cannot escape their configured roots.
4. New run directories are isolated, owner-only where supported, and never
   overwrite an existing run.
5. JSON and text writes use temporary sibling files and atomic rename.
6. Lifecycle manifests start as `running`, update timestamps, and finish as
   `completed` or `partial`.
7. Filesystem and validation failures use typed errors.
8. Contract fixtures, structural boundary tests, and temporary-filesystem
   integration tests pass under `npm run verify:full`.

## Implementation Checklist

- [x] Add Zod runtime validation.
- [x] Implement report contract schemas and inferred types.
- [x] Implement typed artifact-store errors.
- [x] Implement run ID and portable path helpers.
- [x] Implement atomic JSON and text writes.
- [x] Implement run initialization and lifecycle manifest updates.
- [x] Add representative contract fixtures and schema tests.
- [x] Add temporary filesystem and permission tests.
- [x] Add focused architecture boundary tests.
- [x] Update architecture and source-map documentation.
- [x] Run clean-install full verification.

## Decision Log

- 2026-06-12: Use Zod 4 for retained JSON boundaries because the accepted
  technology stack specifies runtime schema validation and static typing alone
  cannot validate historical artifacts.
- 2026-06-12: Public schemas accept unknown additive fields so consumers remain
  compatible with the report contract.
- 2026-06-12: Keep artifact persistence independent of CLI rendering and
  runner-specific behavior.

## Verification

- `npm ci` -> passed; 95 packages audited, no vulnerabilities reported
- `npm run verify:full` -> passed
  - format check passed
  - lint passed
  - strict type check passed
  - 37 tests passed across 8 test files
  - production build passed
  - project-map verification passed with 26 Markdown files and 113 references
  - offline package smoke passed
  - project-map, package, and type-check honesty gates passed
- `git diff --check` -> passed

## Runtime Evidence

Temporary-filesystem integration tests proved:

- deterministic run ID creation
- owner-only run directory and manifest permissions on POSIX
- valid `running`, `completed`, and `partial` manifests
- collision refusal
- typed missing-run and malformed-manifest failures
- portable artifact references
- preservation of the previous file when replacement serialization fails
- cleanup after every temporary test run

## Risks And Mitigations

- Risk: schema implementation drifts from the written contract.
- Mitigation: representative pass, failure, running, and partial fixtures are
  parsed in tests.
- Risk: path helpers permit traversal or platform-specific separators.
- Mitigation: reject absolute, parent, empty-segment, and backslash paths.
- Risk: interrupted writes corrupt an existing report.
- Mitigation: write a unique sibling file, sync and close it, then rename.
- Risk: filesystem errors lose actionable context.
- Mitigation: wrap errors with stable typed codes and preserve the cause.

## Completion Notes

Completed Milestone 1.

Delivered:

- Zod-backed `run.json` and `result.json` schemas with inferred types
- representative pass, failure, running, and partial JSON fixtures
- typed artifact-store errors
- contracted run ID generation
- portable path validation and run-relative normalization
- atomic JSON and text persistence
- run initialization, reading, lifecycle updates, and terminal-state protection
- focused CLI-boundary structural test

No CLI command, configuration, runner, hook, or diagnosis behavior was added.

## Follow-Ups

- [ ] Add configuration-boundary contract tests in Milestone 2.
- [ ] Add temporary Git and subprocess boundary tests in Milestone 3.
