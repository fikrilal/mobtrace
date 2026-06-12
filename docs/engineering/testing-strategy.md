# Testing Strategy

Status: Accepted

## Purpose

This document defines how MobTrace proves behavior while keeping tests fast,
deterministic, and aligned with public contracts.

## Principles

- Test behavior at the lowest layer that proves it.
- Prefer deterministic fixtures over live infrastructure.
- Test failure paths for every external boundary.
- Use temporary directories and repositories for filesystem and Git behavior.
- Preserve observable command output and exit-code contracts.
- Use real Maestro only for controlled end-to-end acceptance.

## Unit Tests

Use unit tests for deterministic logic:

- parsing and validation
- path normalization
- lifecycle state transitions
- failure classification
- signature matching
- diff inspection and ranking
- redaction
- report rendering

Unit tests should avoid real subprocesses and global filesystem state.

## Contract Tests

Use fixed fixtures for externally observable compatibility:

- CLI stdout, stderr, and exit codes
- configuration discovery and precedence
- public JSON report shapes
- Markdown report facts
- runner-result parsing
- report regeneration

When a public contract changes intentionally, update the document and fixture
in the same focused change.

## Integration Tests

Use real local boundaries with controlled dependencies:

- temporary directories for artifact behavior
- temporary Git repositories for source collection
- fake executables for subprocesses, hooks, and Maestro
- isolated npm projects for package installation
- signals and timeouts against disposable child processes

Integration tests must clean their temporary resources.

## End-To-End Tests

Use end-to-end tests sparingly for:

- packaged CLI invocation
- one controlled real-Maestro journey
- complete evidence collection and report generation

`mobile-core-kit` is the realistic external dogfood integration.

When Maestro integration begins, add a separate minimal fixture project for
deterministic pass and failure scenarios.

## Test Placement

- source tests live under `test/`
- fixtures should live near the tests that own them
- shared public-contract fixtures may use a dedicated `test/fixtures/`
  hierarchy when repetition appears

Do not create empty fixture directories in advance.

## Verification By Risk

Low risk:

- targeted test or documentation check
- `npm run verify`

Medium risk:

- `npm run verify`
- `npm run verify:full` when available
- targeted contract or integration tests

High risk:

- all relevant mechanical gates
- failure-path integration tests
- runtime evidence
- human review

## Coverage

Coverage percentage is not an initial gate.

Prioritize meaningful contract and failure-path coverage. Add a numeric
threshold only after the repository has enough code and history for the number
to represent useful risk.

## Test Honesty

Tests must fail for the intended reason.

For repository-specific gates, use controlled known violations to prove the
gate detects regressions. See `docs/engineering/guardrails.md`.
