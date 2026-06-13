# MobTrace Architecture

Status: Accepted

## Purpose

This document defines MobTrace's implementation boundaries and dependency
direction. It describes the current architecture and the boundaries that later
milestones should establish without prescribing one directory per concept.

## Principles

- CLI presentation does not own product logic.
- External systems are accessed through explicit boundaries.
- Diagnosis consumes normalized evidence, not runner-specific layouts.
- Reports consume stable result models, not raw logs.
- Project-specific behavior executes outside the MobTrace core.
- Missing optional evidence reduces diagnostic certainty rather than crashing
  report generation.
- Facts and inferences remain separate.

## Current Source Map

```text
src/
src/artifacts/
  atomic-write.ts
  errors.ts
  paths.ts
  run-id.ts
  store.ts
src/commands/
  doctor.ts
  init.ts
  io.ts
src/configuration/
  duration.ts
  errors.ts
  load.ts
  resolve.ts
  schema.ts
src/contracts/
  report.ts
src/hooks/
  lifecycle.ts
src/process/
  execute.ts
  redaction.ts
src/source/
  git.ts
src/verify/
  lifecycle.ts
src/cli-error.ts
src/cli.ts       executable entry point
src/program.ts   Commander program construction
src/version.ts   package version

test/
test/fixtures/
  report/
test/architecture-boundaries.test.ts
test/artifact-paths.test.ts
test/artifact-store.test.ts
test/configuration.test.ts
test/hook-lifecycle.test.ts
test/package-smoke.test.ts
test/process-execution.test.ts
test/program.test.ts
test/project-map.test.ts
test/report-contract.test.ts
test/run-id.test.ts
test/source-git.test.ts
test/verify-lifecycle.test.ts
```

The current codebase implements the CLI foundation, public report schemas,
artifact storage, strict project configuration loading, static command
resolution, the `init`/`doctor` commands, and the product subprocess execution
boundary, Git source evidence capture, and hook lifecycle execution. Do not
create empty layers in anticipation of future milestones. The verify lifecycle
orchestrator coordinates those foundations through injected runner behavior.

## Intended Boundaries

Introduce these boundaries only when their product milestone needs them:

- command interface
- application orchestration
- configuration
- artifact storage
- process execution
- source control
- runner integration
- evidence normalization
- diagnosis
- reporting

These are responsibilities, not a requirement for a package or directory per
bullet.

## Dependency Direction

The intended dependency direction is:

```text
CLI
  -> application orchestration
    -> configuration, source control, process execution, runner integration
    -> evidence normalization
      -> diagnosis
      -> reporting
    -> artifact storage
```

Rules:

- CLI code may format results but must not parse Maestro artifacts.
- Runner-specific parsing stays within the runner integration boundary.
- Evidence normalization may consume runner-specific results and produce
  runner-independent facts.
- Diagnosis consumes normalized facts, source changes, and retained diagnosis
  context.
- Reporting consumes canonical result models.
- Artifact storage owns filesystem persistence semantics.
- Process execution owns subprocess, timeout, signal, and stream behavior.
- Project hooks remain external commands declared by project configuration.

## External Boundaries

Treat these as untrusted inputs:

- CLI arguments
- YAML and JSON
- process output
- environment values
- Git output
- Maestro output and artifacts
- project hook output
- retained historical artifacts

Validate and normalize at the boundary. Internal code should operate on typed
values rather than repeatedly reinterpret external strings.

## Public Contracts

The implementation must follow:

- `docs/contracts/cli.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`

Changing externally observable behavior requires updating the relevant
contract and reviewing compatibility consequences.

## Enforcement

Harness Phase 0 documents these boundaries.

Harness Phase 2 should add focused structural tests after real modules exist.
Do not add dependency-cruiser before cross-module complexity demonstrates a
need for it.

## Architecture Decisions

Use an ADR when changing:

- the language, runtime, module system, or package manager
- public contract versioning strategy
- the external runner boundary
- artifact persistence model
- deterministic diagnosis policy
- a major source layout or dependency direction

See `docs/adr/README.md`.
