# MobTrace Engineering Harness Proposal

Status: Accepted

## Purpose

This proposal defines an agent-first engineering harness for MobTrace.

The harness should help coding agents:

- discover the correct repository knowledge
- plan non-trivial work
- implement within explicit boundaries
- receive fast mechanical feedback
- verify observable behavior
- record evidence honestly
- improve the repository when recurring failures expose missing capabilities

This document is intentionally separate from the MobTrace product roadmap.
The harness governs how MobTrace is built; it is not a MobTrace product
feature.

## Context

MobTrace is intended to improve the mobile development feedback loop for coding
agents. Its own repository should therefore demonstrate the same engineering
qualities it promotes:

- deterministic feedback
- inspectable evidence
- clear failure ownership
- stable contracts
- low dependence on human memory

The current repository already has:

- product and engineering proposals
- CLI, configuration, and report contracts
- a staged implementation plan
- execution-plan records
- TypeScript build, formatting, linting, tests, and packaging
- one aggregate `npm run verify` command

It does not yet have a complete repository-level operating harness.

## Sources And Lessons

This proposal draws from:

- `mobile-core-kit`
- `backend-core-kit`
- OpenAI's article, "Harness engineering: leveraging Codex in an agent-first
  world"

The recurring lessons are:

1. Repository knowledge must be the system of record.
2. Agents need a map, not one giant instruction manual.
3. Important boundaries should be mechanically enforced.
4. Plans must preserve state across sessions.
5. Static checks and runtime evidence solve different problems.
6. A gate is only trustworthy if it is proven capable of failing.
7. The documented starting path should be smoke tested.
8. Repeated failures should improve the harness rather than agent memory.
9. Parallel agents need isolated working trees.
10. Harness complexity must be earned by recurring real problems.

## Goals

The initial harness should:

- give agents one concise repository entry point
- make authoritative documents easy to discover
- establish a consistent task-to-verification loop
- distinguish low-, medium-, and high-risk changes
- provide one canonical local quality gate
- verify that the distributed package actually works
- preserve exact verification evidence in execution plans
- detect drift in repository knowledge and critical contracts
- prove that important gates reject known violations
- support future runtime evidence without prematurely implementing it

## Non-Goals

The initial harness will not:

- reproduce every guardrail from either core-kit repository
- add checks without a demonstrated failure mode
- require GitHub CI for local development
- implement the MobTrace product roadmap
- create a large architecture framework before module boundaries exist
- add duplication detection to a small codebase
- require runtime Maestro execution before the runner integration exists
- introduce background agents or hosted services
- optimize for maximum process ceremony

## Core Principle

The harness should make correct work easier and incorrect work obvious.

It should enforce invariants, not prescribe every implementation detail.

The preferred escalation order is:

1. clear documentation
2. reusable helper or scaffold
3. static configuration or lint
4. repository verification script
5. runtime evidence
6. CI gate

Use the lightest mechanism that reliably prevents the observed problem.

## Harness Model

The MobTrace harness has three layers.

```text
Knowledge
  Repository map, contracts, architecture, plans, decisions

Mechanical feedback
  Format, lint, types, tests, package smoke, contract and drift checks

Runtime feedback
  Fake tools, temporary repositories, subprocesses, hooks, Maestro, artifacts
```

Each layer should remain useful independently.

### Knowledge Layer

The knowledge layer tells an agent:

- what MobTrace is
- where authoritative decisions live
- which contracts govern behavior
- how work should be planned
- which verification is required
- when human review is expected

### Mechanical Feedback Layer

The mechanical layer provides cheap, deterministic checks for:

- formatting
- linting
- strict typing
- unit and contract tests
- production build
- package contents and installed binary behavior
- documentation and project-map drift
- public schema and fixture stability
- architecture boundaries once those boundaries exist

### Runtime Feedback Layer

The runtime layer proves behavior that static checks cannot establish:

- external process invocation
- signal and timeout handling
- Git behavior in real temporary repositories
- hook preparation and cleanup ordering
- Maestro invocation and evidence discovery
- report regeneration from retained evidence
- cross-platform behavior

Runtime evidence should be introduced alongside the product capability it
validates.

## Repository Knowledge Architecture

### `AGENTS.md`

`AGENTS.md` should remain short and serve as the operating contract and map.

It should contain:

- simplicity and scope discipline
- authoritative documentation entry points
- execution-plan requirement
- canonical verification commands
- risk and runtime-evidence expectations
- source-control safety
- repeated-failure harness upgrade rule

It should not duplicate:

- full architecture guidance
- public command contracts
- complete testing strategy
- long implementation recipes
- product specifications

### Documentation Index

`docs/README.md` should be the documentation entry point.

The existing root-level documents should be reorganized into this taxonomy:

```text
docs/
  README.md
  product/
  contracts/
  engineering/
  exec-plans/
  adr/
```

The reorganization should be performed as one focused harness change. It must:

- preserve document history through file moves
- update every repository-local link
- keep product, contract, engineering, and execution-plan roles distinct
- avoid rewriting document content unless required by the new location
- add drift verification after the new structure is established

### Document Roles

Documents should have explicit roles:

- product documents define user need, value, scope, and success
- contracts define stable external behavior
- engineering documents define implementation boundaries and workflows
- ADRs record accepted architectural decisions
- execution plans coordinate active work
- `_WIP/` contains proposals that are not yet authoritative

Agents must not treat `_WIP/` as accepted policy unless a task explicitly
references it.

### Status Vocabulary

Use a small status vocabulary:

- `Draft`: incomplete and under discussion
- `Proposed`: complete enough for review
- `Accepted`: authoritative
- `Superseded`: replaced by another document
- `Completed`: execution plan finished

## Agent Delivery Loop

The default MobTrace agent loop should be:

```text
Task intake
  -> inspect current state
  -> define observable acceptance criteria
  -> classify risk
  -> create execution plan when non-trivial
  -> implement a focused slice
  -> run targeted checks
  -> run canonical verification
  -> collect runtime evidence when required
  -> self-review the diff
  -> record exact evidence
  -> complete or update the plan
```

### Task Intake

Before implementation:

- state the objective in one concrete sentence
- define observable acceptance criteria
- identify contract sections affected
- identify explicit non-goals
- classify risk
- inspect existing code and harness behavior

### Implementation

During implementation:

- prefer the minimum complete change
- preserve public contracts
- keep product logic outside CLI presentation
- isolate external boundaries
- avoid speculative abstractions
- update the harness only when the task reveals a real need

### Verification

Agents must not claim completion unless relevant checks were actually run.

Verification records should state:

- exact command
- outcome
- relevant artifact path
- skipped check and reason
- known residual risk

### Self-Review

Before completion, the agent should check:

- acceptance criteria are met
- public contracts remain aligned
- errors and failure ownership are explicit
- tests cover meaningful failures
- no project-specific mobile logic entered the core
- generated artifacts are intentional
- no unrelated work is included

## Risk Model

### Low Risk

Examples:

- documentation
- test-only changes
- narrow internal refactors
- formatting and tooling configuration
- local helpers with no external behavior change

Expected evidence:

- targeted checks
- canonical mechanical verification

### Medium Risk

Examples:

- CLI behavior
- configuration resolution
- report rendering
- schema implementation
- Git evidence collection
- deterministic diagnosis rules

Expected evidence:

- canonical mechanical verification
- targeted contract or integration tests
- fixture evidence for externally observable behavior

Human review is strongly recommended when public contracts change.

### High Risk

Examples:

- subprocess execution
- shell boundaries
- signals and timeouts
- lifecycle hooks
- cleanup behavior
- secret redaction
- artifact deletion
- exit-code precedence
- release and publishing

Expected evidence:

- canonical mechanical verification
- failure-path integration tests
- runtime evidence
- explicit rollback or containment strategy
- human review

## Execution Plans

Execution plans are the durable state for non-trivial work.

Required lifecycle:

1. create a plan under `docs/exec-plans/active/`
2. update decisions and progress during implementation
3. record verification evidence
4. move the completed plan to `docs/exec-plans/completed/`
5. record unresolved work in the technical-debt tracker

Execution plans should include:

- objective
- contract references
- current state
- constraints and non-goals
- risk class
- acceptance criteria
- implementation checklist
- decision log
- verification
- runtime evidence
- risks and rollback
- completion record
- follow-up debt

Roadmaps and execution plans are different:

- the implementation plan defines milestone ordering
- an execution plan defines one reviewable implementation slice

## Canonical Commands

The harness should expose stable commands.

### Fast Development Checks

Existing targeted commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

### Canonical Local Gate

```bash
npm run verify
```

This should remain fast enough to run after every meaningful change.

Initial contents:

- format check
- lint
- type check
- unit and contract tests
- production build

### Full Harness Gate

Proposed:

```bash
npm run verify:full
```

This should include:

- canonical local gate
- project-map and documentation-link verification
- package-content verification
- isolated installed-binary smoke test
- gate-honesty checks

Later milestones may add:

- temporary Git repository integration tests
- fake-hook integration tests
- fake-Maestro contract tests
- report-fixture compatibility tests
- runtime evidence checks

The full gate must not silently become a slow duplicate of CI.

`verify:full` is required for non-trivial changes. Tiny documentation fixes and
other low-risk mechanical edits may use targeted checks plus `npm run verify`
when the full harness does not provide meaningful additional evidence.

## Package Smoke Verification

The documented distribution path must be tested.

The smoke test should:

1. build MobTrace
2. create an npm package tarball
3. inspect included files
4. install it into an isolated temporary project
5. invoke `mobtrace --help`
6. invoke `mobtrace --version`
7. clean temporary files

This prevents a repository build from passing while the published package is
broken.

The check should be automated rather than retained only as an execution-plan
command transcript.

## Gate Honesty

Important gates must be proven capable of failing.

Initial candidates:

- format check rejects malformed formatting
- lint rejects a known lint violation
- type check rejects a known type error
- package smoke rejects a missing executable or invalid package entry
- documentation drift rejects a broken required link

Gate-honesty checks should:

- operate in isolated temporary files or directories
- never mutate tracked source permanently
- assert the expected failure signal
- fail when the target gate unexpectedly succeeds

Do not create honesty tests for every trivial command. Use them for gates whose
silent ineffectiveness would create false confidence.

## Documentation And Project-Map Drift

A repository-local checker should verify:

- required documentation entry points exist
- links in the documentation index resolve
- execution-plan directories and template exist
- accepted contract files are indexed
- package scripts referenced by docs exist
- key source directories are represented in architecture documentation once
  the source structure becomes non-trivial

The checker should validate structure, not writing style.

## Architecture Enforcement

Architecture enforcement should follow implementation reality.

Do not add dependency rules before meaningful boundaries exist.

When Milestone 1 and later establish stable modules, likely boundaries include:

- CLI presentation
- application orchestration
- configuration
- artifact storage
- process execution
- source control
- runner integration
- evidence normalization
- diagnosis
- reporting

Candidate invariants:

- CLI code depends on application services, not runner details
- diagnosis consumes normalized evidence, not Maestro artifact paths
- reporting consumes stable result models
- project-specific hooks remain external process boundaries
- source control and process execution remain replaceable in tests

These should eventually be enforced through dependency rules or structural
tests. They should not rely only on documentation.

## Testing Strategy

### Unit Tests

Use for deterministic logic:

- parsing and validation
- path normalization
- state transitions
- classification
- ranking
- redaction
- report rendering

### Contract Tests

Use fixed fixtures for:

- CLI output and exit behavior
- configuration precedence
- public JSON reports
- Maestro result parsing
- failure signatures
- report regeneration

### Integration Tests

Use temporary directories, repositories, and fake executables for:

- package installation
- Git source capture
- subprocess output and exit codes
- hook sequencing
- timeout and signal behavior
- cleanup after failure
- artifact isolation

### End-To-End Tests

Use a controlled mobile fixture or reference project for:

- real Maestro invocation
- compiled application journey
- evidence collection
- complete report generation

`mobile-core-kit` should be a dogfood and reference integration, not the only
acceptance environment.

## Runtime Evidence Evolution

Runtime evidence should be added incrementally.

### Before Maestro Integration

Use:

- fake executables
- temporary Git repositories
- controlled hook commands
- retained test artifacts

### After Maestro Integration

Add:

- fake-Maestro output fixtures
- one controlled real-Maestro smoke scenario
- pass, failure, timeout, and unavailable-device evidence
- report artifact verification

### Before Public Release

Add:

- Linux evidence
- macOS evidence
- repeated-run reliability measurements
- package installation evidence
- representative dogfood flows

## Parallel Agent Workflow

Use:

1. one Git worktree and branch per agent
2. separate clones when worktrees are unsuitable
3. one shared working tree only as a last resort

High-contention paths should have one owner at a time:

- `package.json`
- `package-lock.json`
- `AGENTS.md`
- public contracts
- architecture rules
- shared test fixtures
- release configuration
- generated reports and baselines

In a shared working tree:

- assign explicit path ownership
- do not use `git add .`
- do not revert unrelated changes
- avoid broad formatting
- stop when another agent is editing the same file

## Failure-To-Harness Upgrade Rule

When the same failure, review comment, or workflow gap occurs at least twice,
promote it into the harness.

Possible responses:

- improve documentation
- add a reusable helper
- update a scaffold
- add a fixture
- add a lint or structural rule
- add a verify script
- add runtime evidence

The upgrade must solve a demonstrated recurring problem. Two occurrences are a
trigger for evaluation, not an automatic requirement to add a complex gate.

## Entropy Management

Agent throughput can spread weak patterns quickly.

MobTrace should use continuous, small cleanup rather than periodic broad
rewrites.

Initial approach:

- keep execution-plan follow-ups explicit
- track technical debt in one repository file
- review recurring test and review failures
- improve existing checks before adding new ones
- avoid permanent baselines for new violations

Potential later additions:

- architecture smell scans
- duplication reports
- quality scorecards
- recurring documentation gardening

These should be added only after repository size and failure history justify
them.

## CI Position

The local harness is the primary design target.

CI is explicitly deferred until the local harness is implemented and proven
useful. When introduced, it should call the same repository commands rather
than reimplement their logic in workflow YAML.

Initial future CI should be small:

- install dependencies
- run `npm run verify:full`
- upload test artifacts when useful

Expensive mobile runtime execution should not become a default PR gate until
local reliability and duration measurements justify it.

This preserves MobTrace's purpose as a local agent feedback tool and avoids
premature infrastructure cost.

## Proposed Initial Harness Scope

Before Milestone 1, implement only:

1. short `AGENTS.md`
2. `docs/README.md`
3. engineering architecture guide
4. agent delivery-loop guide
5. guardrails guide
6. testing strategy
7. parallel-agent workflow
8. execution-plan README and template
9. technical-debt tracker
10. package smoke script
11. documentation/project-map drift check
12. focused gate-honesty checks
13. `npm run verify:full`
14. pull-request template

Do not add:

- Maestro runtime execution
- duplication detection
- generic architecture lint framework
- cross-platform CI matrix
- release automation
- background maintenance agents

## Delivery Phases

### Harness Phase 0: Knowledge And Workflow

- add `AGENTS.md`
- index repository documentation
- define document roles and statuses
- define agent loop and risk classes
- establish execution-plan lifecycle
- establish parallel-agent rules

Exit criteria:

- a new agent can locate every authoritative source from `AGENTS.md`
- non-trivial work has one documented planning workflow
- `_WIP/` cannot be mistaken for accepted policy

### Harness Phase 1: Mechanical Trust

- automate package smoke verification
- add documentation/project-map drift verification
- add focused gate-honesty checks
- add `npm run verify:full`

Exit criteria:

- a clean checkout can run the full local gate
- the packed CLI is tested after isolated installation
- critical gates are proven to reject known violations
- documentation drift produces an actionable failure

### Harness Phase 2: Product-Boundary Enforcement

Implement alongside product Milestones 1 through 3:

- architecture boundary tests
- schema fixtures
- configuration contract tests
- temporary Git repository tests
- fake subprocess and hook tests

Exit criteria:

- public contracts are represented by executable fixtures
- external boundaries can be tested without real mobile infrastructure
- invalid dependency directions fail mechanically

### Harness Phase 3: Runtime Legibility

Implement alongside Maestro and report milestones:

- fake-Maestro fixtures
- controlled real-Maestro smoke project
- artifact inspection helpers
- failure-path runtime evidence
- duration and reliability measurements

Exit criteria:

- agents can execute, inspect, and diagnose a complete controlled run
- infrastructure failures remain distinguishable from journey failures
- runtime evidence is retained and easy to reference

### Harness Phase 4: Release And Maintenance

Implement only after product validation:

- minimal CI calling repository-native commands
- Linux and macOS support evidence
- release package verification
- quality and debt review cadence
- targeted entropy checks justified by repository history

Exit criteria:

- public release checks are reproducible from a clean checkout
- supported-platform claims are evidence-backed
- recurring degradation has an explicit maintenance response

## Success Criteria

The harness is successful when:

- agents need less human intervention to find the correct workflow
- failures point to the responsible phase and corrective action
- verification claims are reproducible
- public contract drift is caught before review
- packaged behavior is tested, not assumed
- runtime-sensitive work includes observable proof
- recurring mistakes become cheaper over time
- harness runtime remains proportional to risk

## Failure Modes

The harness is failing if:

- `AGENTS.md` becomes a large duplicate manual
- agents run many checks without understanding which matter
- gates pass while known violations are accepted
- package behavior differs from repository behavior
- docs and code disagree without detection
- runtime evidence requires undocumented human intervention
- every small change requires the most expensive verification lane
- baselines and allowlists become places to hide new debt
- harness implementation delays product validation without reducing real risk

## Resolved Decisions

- Reorganize the existing documentation into the proposed taxonomy as a
  focused harness change.
- Require `npm run verify:full` for non-trivial changes, not every tiny edit.
- Defer CI until the local harness is established and measured.
- Limit initial gate-honesty checks to repository-specific behavior:
  documentation drift, package smoke, and the composed type-check gate.
- Use focused structural tests for architecture enforcement while MobTrace's
  module boundaries are small and evolving. Reconsider dependency-cruiser only
  after real cross-module complexity appears.
- Keep `mobile-core-kit` as the realistic external dogfood integration. Add a
  separate minimal fixture project when Maestro integration begins so
  deterministic pass and failure scenarios do not depend on a large
  application.

## Recommendation

Accept the architecture and staged approach, then create one focused execution
plan for Harness Phases 0 and 1.

Do not implement later harness phases now. Each product milestone should add
the smallest harness capability needed to make its new behavior legible,
testable, and enforceable.
