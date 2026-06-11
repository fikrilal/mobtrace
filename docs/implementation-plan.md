# MobTrace Implementation Plan

Status: Proposed

## Purpose

This document defines the ordered path from the accepted MobTrace contracts to
a usable v0.1 release.

It is the durable implementation roadmap. It is not an execution plan for one
agent session.

Before implementing a non-trivial slice, an agent should create a focused
execution plan that:

- names the milestone and acceptance criterion it advances
- identifies the files and boundaries expected to change
- defines the tests and verification commands
- records risks, assumptions, and deferred work
- remains small enough to complete and review independently

The product, engineering, CLI, configuration, and report contracts remain
authoritative. An execution plan may refine implementation details but must not
silently change those contracts.

## Planning Principles

- Deliver a working vertical path early.
- Keep each milestone independently testable.
- Build deterministic behavior before adding heuristics.
- Use fake executables and recorded fixtures for most tests.
- Require a real Maestro project only for end-to-end acceptance.
- Keep project-specific behavior outside the MobTrace core.
- Avoid a generic runner plugin system in v0.1.
- Do not add features listed as deferred in the public contracts.

## Definition Of Done

A work item is complete only when:

- implementation matches the relevant public contracts
- automated tests cover expected behavior and important failures
- formatting, linting, type checking, and tests pass
- user-visible behavior is documented when needed
- no project-specific logic has leaked into the core
- the execution plan records its final verification evidence

A milestone is complete only when all of its exit criteria are demonstrated.

## Milestone 0: Repository Foundation

### Goal

Establish a small, reliable TypeScript CLI project without implementing product
behavior prematurely.

### Deliverables

- Node.js and package-manager version constraints
- TypeScript build configuration
- package scripts for build, type check, lint, format, and test
- CLI executable entry point
- initial source and test directory structure
- automated checks suitable for local use and future CI
- basic contributor and development instructions

### Required Behavior

- `mobtrace --help` runs from the built package.
- `mobtrace --version` prints only the package version.
- unsupported commands fail through the CLI framework.
- the package can be installed and invoked through its declared binary.

### Verification

- clean dependency installation
- production build
- type check
- lint and format check
- unit test command
- packaged binary smoke test

### Exit Criteria

- a clean checkout can build and invoke the CLI
- the repository has one documented verification command
- no MobTrace domain behavior is hidden in bootstrap code

## Milestone 1: Core Contracts And Filesystem Model

### Goal

Represent the accepted contracts as typed internal models and safe filesystem
operations.

### Deliverables

- shared status, outcome, phase, and error types
- typed `run.json` and `result.json` models
- run identifier generation
- artifact-root and run-directory resolution
- atomic JSON and text file writes
- lifecycle manifest creation and updates
- run-relative POSIX artifact references
- owner-only run-directory permissions where supported

### Required Behavior

- a run starts with a valid `run.json` in `running` state
- terminal manifests use `completed` or `partial`
- public artifacts do not contain machine-specific absolute paths
- interrupted writes do not replace the last valid generated report

### Verification

- unit tests for identifiers, path normalization, and serialization
- temporary-directory tests for atomic writes and permissions
- schema fixture tests for representative manifests and results

### Exit Criteria

- generated lifecycle manifests conform to `docs/report-contract.md`
- filesystem failures produce typed internal errors
- artifact operations are isolated from CLI rendering

## Milestone 2: Configuration And Command Resolution

### Goal

Implement deterministic project discovery, configuration validation, and CLI
input resolution.

### Deliverables

- project-root resolution
- `mobtrace.yaml` discovery
- strict version `1` schema validation
- unknown-field rejection
- path, timeout, environment, flow, and precedence resolution
- `init` command
- `doctor` checks that do not require journey execution
- human and JSON doctor output

### Required Behavior

- a direct Maestro path works without configuration
- named flows resolve through `mobtrace.yaml`
- CLI values override flow and project defaults as contracted
- secret environment values are not printed
- invalid configuration fails before external execution

### Verification

- table-driven configuration validation tests
- precedence tests
- malformed YAML and unknown-field tests
- temporary-project tests for discovery and `init`
- CLI tests for stdout, stderr, and exit codes

### Exit Criteria

- `init` and `doctor` satisfy the CLI contract
- zero-configuration and configured flow resolution both work
- resolved configuration is immutable and safe for downstream services

## Milestone 3: Process, Git, And Hook Infrastructure

### Goal

Build the external-process and source-evidence foundations needed by the run
lifecycle.

### Deliverables

- centralized subprocess executor
- separated stdout and stderr capture
- timeout and signal handling
- redacted command summaries
- Git worktree discovery
- branch, revision, status, changed-file, and diff capture
- preparation and cleanup hook execution
- hook output protocol parsing
- normalized source and hook result artifacts

### Required Behavior

- direct execution is used when shell interpretation is unnecessary
- cleanup can run after pass, failure, and safe interruption
- original external exit codes are retained
- hook secrets and exported values are not logged
- source capture uses the configured baseline

### Verification

- fake executable tests for output, timeout, and termination
- temporary Git repository tests for clean, dirty, staged, and untracked states
- hook sequencing and failure tests
- cleanup-after-failure tests
- redaction tests

### Exit Criteria

- external commands have one tested execution boundary
- source evidence matches the report contract
- preparation and cleanup outcomes remain independently inspectable

## Milestone 4: Maestro Vertical Slice

### Goal

Complete the first useful end-to-end path: run one existing Maestro journey and
retain enough evidence to report its outcome.

### Deliverables

- Maestro availability and version detection
- device argument handling
- journey invocation
- runner stdout, stderr, exit code, duration, and artifact capture
- normalized runner result
- run orchestrator covering every lifecycle phase
- initial `verify` human output
- initial machine-readable `result.json`

### Required Behavior

- a passing journey returns exit code `0`
- a failing journey returns exit code `1`
- setup, infrastructure, cleanup, processing, and interruption outcomes use the
  contracted exit-code precedence
- cleanup runs regardless of journey pass or failure where possible
- raw evidence remains available when later processing fails

### Verification

- contract tests against recorded Maestro outputs
- integration tests using a fake Maestro executable
- lifecycle outcome-precedence tests
- stdout and stderr purity tests
- one controlled real-Maestro smoke test

### Exit Criteria

- `mobtrace verify --flow <path>` works without project hooks
- the complete artifact skeleton is produced for pass and failure
- a coding agent can distinguish journey failure from tool failure

## Milestone 5: Evidence Normalization And Baseline Reports

### Goal

Produce stable, inspectable reports from retained evidence without advanced
diagnosis.

### Deliverables

- runner-independent normalized evidence
- canonical `result.json`
- Markdown `report.md`
- evidence index
- compact terminal diagnosis
- `report latest` and explicit run resolution
- report regeneration without rerunning hooks or Maestro
- JSON-only command output

### Required Behavior

- all generated JSON follows `docs/report-contract.md`
- `--json` emits one valid JSON object and no prose to stdout
- `report` does not inherit the historical journey exit code
- report regeneration preserves lifecycle facts
- partial runs remain inspectable when enough evidence exists

### Verification

- golden tests for JSON and Markdown reports
- report regeneration tests
- latest-run ordering tests
- missing and stale generated-report tests
- sensitive-evidence reference tests

### Exit Criteria

- pass, journey failure, infrastructure failure, cleanup failure, interrupted,
  and partial fixtures produce valid reports
- reports link to retained evidence using portable run-relative paths
- human wording and machine fields remain clearly separated

## Milestone 6: Deterministic Diagnosis

### Goal

Deliver MobTrace's core product value: actionable, evidence-backed correlation
between a failed journey and the current source change.

### Deliverables

- failed command, assertion, selector, and message extraction
- failure-class classification
- failure-domain classification
- deterministic diff-hunk inspection
- suspicious-change ranking
- ownership metadata bias
- built-in and project-defined failure signatures
- evidence-backed explanations and suggested actions

### Required Behavior

- observed facts remain separate from inferred diagnosis
- ranking reasons identify the deterministic rules that contributed
- unsupported conclusions produce `unknown`
- ownership metadata biases ranking but does not exclude other changes
- repeated inputs produce byte-equivalent diagnosis fields

### Verification

- fixture tests for every initial failure class and domain
- historical-failure signature tests
- selector, route, semantics ID, auth/session, payload, fixture, and cleanup diff
  tests
- ranking tie-break tests
- determinism tests
- unmatched-failure tests

### Exit Criteria

- selector changes rank test-flow files for selector failures
- API payload changes rank repository or data files for backend failures
- navigation and session changes rank application files for navigation failures
- at least three real historical failures produce useful next actions

## Milestone 7: Security And Reliability Hardening

### Goal

Make local execution trustworthy enough for public use.

### Deliverables

- built-in and configured redaction
- sensitive-evidence markings and warnings
- bounded log and artifact handling
- robust interruption and partial-run recovery
- malformed external-artifact handling
- Linux and macOS compatibility verification
- performance and duration instrumentation

### Required Behavior

- generated outputs exclude known secrets
- raw evidence is never described as fully redacted
- one corrupt optional artifact does not erase other evidence
- MobTrace does not upload data or access a hosted service
- unsupported platform behavior is reported honestly

### Verification

- credential and token redaction fixtures
- hostile and malformed input tests
- large-log tests
- interrupted-process tests
- Linux and macOS test matrix
- repeated-run reliability measurements

### Exit Criteria

- no known secret fixture appears in generated output
- partial and interrupted runs remain inspectable
- supported-platform claims are backed by automated evidence

## Milestone 8: Dogfood And Product Validation

### Goal

Prove that MobTrace is more useful than raw Maestro output plus a Git diff.

### Deliverables

- standalone fixture project for repeatable end-to-end tests
- documented `mobile-core-kit` reference integration
- representative pass and failure scenarios
- measured report usefulness, reliability, and duration
- installation and first-run documentation
- release checklist

### Validation Scenarios

At minimum, validate:

- passing journey
- selector mismatch caused by a changed flow
- application navigation failure caused by changed app code
- backend HTTP failure correlated with payload or endpoint changes
- unavailable or offline device
- preparation failure
- cleanup failure after a passing journey
- cleanup failure after a failed journey
- interrupted journey
- report regeneration from retained evidence

### Product Evidence

Record:

- whether the first suggested investigation area is correct
- whether the top suspicious files contain the eventual fix
- time from failure to correct investigation area
- artifacts opened before finding the cause
- total MobTrace overhead beyond Maestro execution
- repeated-run success rate on the documented baseline

### Exit Criteria

- the reference integration needs no MobTrace core modification
- the complete CLI, configuration, and report contracts are demonstrated
- measured reports provide materially better first diagnosis than raw Maestro
- product metrics support continuing toward a public v0.1 release
- kill criteria in `docs/product.md` have been explicitly evaluated

## Milestone 9: Public v0.1 Release

### Goal

Publish a small, supportable first release after the product thesis is proven.

### Deliverables

- accepted public contracts
- versioned package and executable
- reproducible release process
- changelog and upgrade policy
- concise user, integration, and troubleshooting documentation
- contribution and security-reporting guidance
- release artifacts verified on supported platforms

### Exit Criteria

- installation works from the selected public distribution channel
- a new project can complete the documented zero-integration path
- public behavior matches the accepted contracts
- all release checks pass from a clean checkout
- known limitations and unsupported platforms are explicit

## Execution Plan Contract

Each implementation execution plan should contain:

```markdown
# <Work Item>

Status: Proposed
Milestone: <number and name>

## Objective

## Contract References

## Current State

## Scope

## Out Of Scope

## Implementation Steps

## Tests And Verification

## Risks And Rollback

## Completion Record
```

Execution-plan rules:

- target one reviewable vertical slice
- link exact contract sections
- state observable acceptance criteria before implementation
- avoid combining unrelated milestones
- update the plan when discovered facts change the approach
- record commands actually run and their results
- leave incomplete work explicitly marked

## Recommended First Execution Plan

Start with Milestone 0 only.

The first execution plan should establish the package, build, test, lint, and
CLI bootstrap. It should not implement configuration parsing, Maestro
execution, report generation, or diagnosis.

That foundation is intentionally narrow. It gives every later agent a stable
toolchain and verification command without prematurely coupling the codebase to
an untested internal architecture.

